import React, { useState, useEffect } from 'react';
import { ShieldCheck, LogOut, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const [stats, setStats] = useState({ totalVisits: 0, latestToken: 'N/A' });
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    age: '',
    blood_group: ''
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  
  useEffect(() => {
    if (profile && !dataLoaded) {
      fetchStats();
      setEditForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        age: profile.age || '',
        blood_group: profile.blood_group || ''
      });
      setDataLoaded(true);
    }
  }, [profile, dataLoaded]);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, token_number, status')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setStats({
          totalVisits: data.length,
          latestToken: data.length > 0 ? (data[0].token_number || `#${data[0].id.substring(0,4).toUpperCase()}`) : 'N/A'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        ...(profile?.role === 'patient' && {
          age: editForm.age ? parseInt(editForm.age) : null,
          blood_group: editForm.blood_group
        })
      };

      const tableName = profile?.role === 'doctor' ? 'doctors' 
                      : profile?.role === 'hospital' ? 'hospital_admins' 
                      : 'patients';

      const { error } = await supabase.from(tableName).update(updates).eq('id', profile.id);
      if (error) {
        // Fallback to old profiles table if new table update failed (e.g., missing row)
        await supabase.from('profiles').update(updates).eq('id', profile.id);
      }
      
      // Update local storage user metadata if full name changed
      if (editForm.full_name !== profile.full_name) {
        await supabase.auth.updateUser({ data: { full_name: editForm.full_name }});
      }

      window.location.reload();
    } catch (err) {
      alert("Error saving profile: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Get the real display name
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  
  return (
    <div className="flex flex-col px-4 md:px-6 pt-4 pb-24 w-full fade-in space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full border-4 border-primary-50 overflow-hidden shadow-md bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
            <span className="text-3xl font-extrabold text-primary-700">{displayName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="absolute bottom-0 right-0 w-7 h-7 bg-primary-700 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">{displayName}</h1>
        
        {displayEmail && (
          <p className="text-gray-400 text-xs font-medium flex items-center mb-3">
            <Mail className="w-3 h-3 mr-1" /> {displayEmail}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2 justify-center mb-5">
          <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-bold capitalize">{profile?.role || 'Patient'}</span>
          <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold">Verified</span>
        </div>

        {/* Stats */}
        <div className="w-full bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100 flex justify-around">
          <div className="flex flex-col items-center">
            <span className="text-gray-400 font-bold text-[10px] uppercase mb-1">Bookings</span>
            <span className="font-extrabold text-xl text-primary-700">{loading ? '-' : stats.totalVisits}</span>
          </div>
          <div className="w-px bg-gray-200"></div>
          <div className="flex flex-col items-center">
            <span className="text-gray-400 font-bold text-[10px] uppercase mb-1">Last Token</span>
            <span className="font-extrabold text-base text-gray-900 mt-0.5">{loading ? '-' : stats.latestToken}</span>
          </div>
        </div>
        
        {isEditing ? (
          <form className="w-full text-left space-y-3 mb-6" onSubmit={handleSaveProfile}>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Full Name</label>
              <input required type="text" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Phone Number</label>
              <input type="text" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
            </div>
            {profile?.role === 'patient' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Age</label>
                  <input type="number" value={editForm.age} onChange={e => setEditForm({...editForm, age: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Blood Group</label>
                  <input type="text" value={editForm.blood_group} onChange={e => setEditForm({...editForm, blood_group: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-primary-500 outline-none" />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-bold shadow-sm">{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setIsEditing(true)}
            className="w-full py-2.5 bg-gray-50 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all active:scale-95 border border-gray-200 mb-3">
            Edit Settings
          </button>
        )}

        <button onClick={signOut}
          className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center">
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </button>

        {/* Delete Account */}
        <div className="mt-6 pt-6 border-t border-gray-100 w-full">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 text-gray-400 rounded-xl text-xs font-medium hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Account
            </button>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-fade-in-up">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-extrabold text-red-700 text-sm">Delete Account Permanently</h3>
              </div>
              <p className="text-xs text-red-600/80 mb-4 leading-relaxed">
                This will permanently delete your account and <b>all associated data</b> including appointments, reports, prescriptions, and slots. This action <b>cannot be undone</b>.
              </p>
              <label className="block text-[10px] font-bold text-red-500 uppercase mb-1.5">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-white border border-red-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-500/20 focus:border-red-400 outline-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (deleteConfirmText !== 'DELETE') {
                      alert('Please type DELETE to confirm.');
                      return;
                    }
                    setDeleting(true);
                    try {
                      const { error } = await supabase.rpc('delete_user_account');
                      if (error) throw error;
                      // Clear all local state and redirect
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.href = '/auth';
                    } catch (err) {
                      console.error('Delete error:', err);
                      alert('Failed to delete account: ' + err.message);
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all
                    ${deleteConfirmText === 'DELETE' && !deleting
                      ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm'
                      : 'bg-red-200 text-red-400 cursor-not-allowed'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleting ? 'Deleting...' : 'Delete Forever'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                  className="flex-1 py-2.5 bg-white text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
