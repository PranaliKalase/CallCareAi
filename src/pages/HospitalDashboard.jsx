import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Plus, CheckCircle, XCircle, User, Clock, Shield, Stethoscope, AlertTriangle, CalendarPlus, Activity, PhoneCall, PlusSquare } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const HospitalDashboard = () => {
  const { user, profile } = useAuth();

  // Hospital registration form
  const [hospitalForm, setHospitalForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    email: '',
    phones: [''],
    lng: '',
    icuBeds: 0,
  });

  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [approvedDoctors, setApprovedDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(false);
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('emergencies');
  const [appointments, setAppointments] = useState([]);

  const [dataLoaded, setDataLoaded] = useState(false);
  const hospitalName = profile?.full_name || user?.user_metadata?.full_name || '';

  useEffect(() => {
    if (user && !dataLoaded) {
      fetchDoctors();
      fetchAppointments();
      setHospitalForm(prev => ({
        ...prev,
        name: hospitalName,
        email: user.email || '',
        address: profile?.address || '',
        city: profile?.city || '',
        state: profile?.state || '',
        description: profile?.description || '',
        phones: profile?.phone ? profile.phone.split(',') : [''],
        lat: profile?.lat || '',
        lng: profile?.lng || '',
        icuBeds: profile?.available_icu_beds || 0,
      }));
      // Only set true when profile actually has loaded some context to avoid overwriting later
      if (profile) setDataLoaded(true);
    }
  }, [user, profile, dataLoaded]);

  const fetchDoctors = async () => {
    try {
      let { data: doctors, error } = await supabase
        .from('doctors')
        .select('*');

      if (error || !doctors) {
        const fallback = await supabase.from('profiles').select('*').eq('role', 'doctor');
        doctors = fallback.data || [];
      }

      // Match doctors by hospital_id or hospital_name (fallback if schema is outdated)
      const matching = (doctors || []).filter(doc => doc.hospital_id === user.id || doc.hospital_name === hospitalName);

      setPendingDoctors(matching.filter(d => !d.is_approved));
      setApprovedDoctors(matching.filter(d => d.is_approved));
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (doctorId, approve) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_approved: approve })
        .eq('id', doctorId);

      if (error) throw error;
      await fetchDoctors();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveHospital = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus('Saving hospital profile…');

    try {
      const hospitalData = {
        full_name: hospitalForm.name,
        address: hospitalForm.address,
        city: hospitalForm.city,
        state: hospitalForm.state,
        description: hospitalForm.description,
        phone: hospitalForm.phones.join(','),
        lat: Number(hospitalForm.lat) || null,
        lng: Number(hospitalForm.lng) || null,
        available_icu_beds: Number(hospitalForm.icuBeds) || 0,
      };

      const { error } = await supabase.from('hospital_admins').update(hospitalData).eq('id', user.id);
      if (error) {
        console.warn('Hospital update note:', error.message);
        throw error;
      }

      setStatus('Hospital profile saved successfully!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setStatus('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, token_number, created_at,
          patient:patients!appointments_patient_id_fkey(full_name),
          doctor:doctors!appointments_doctor_id_fkey(full_name),
          hospital_slots(slot_date, start_time)
        `)
        .eq('hospital_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const generateSlots = async (doctorId) => {
    setGeneratingFor(doctorId || true);
    try {
      const slotsToInsert = [];
      // Generate slots for the next 7 days
      for (let d = 0; d <= 7; d++) {
        const dateObj = addDays(new Date(), d);
        const dateStr = format(dateObj, 'yyyy-MM-dd');

        // Generate 30 mins slots from 9am to 5pm (last slot starts at 16:30)
        for (let h = 9; h < 17; h++) {
          const hour = h.toString().padStart(2, '0');
          // :00 slot
          slotsToInsert.push({
            hospital_id: user.id,
            doctor_id: doctorId || null,
            slot_date: dateStr,
            start_time: `${hour}:00:00`,
            end_time: `${hour}:30:00`
          });
          // :30 slot
          slotsToInsert.push({
            hospital_id: user.id,
            doctor_id: doctorId || null,
            slot_date: dateStr,
            start_time: `${hour}:30:00`,
            end_time: `${(h + 1).toString().padStart(2, '0')}:00:00`
          });
        }
      }

      const { error } = await supabase.from('hospital_slots').upsert(slotsToInsert, {
        onConflict: 'hospital_id, doctor_id, slot_date, start_time',
        ignoreDuplicates: true
      });
      if (error) throw error;
      alert(`Success! Appointment slots for the next 7 days have been generated for ${doctorId ? 'this doctor' : 'the hospital'}.`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate slots: ' + err.message);
    } finally {
      setGeneratingFor(false);
    }
  };

  const updatePhone = (index, value) => {
    setHospitalForm((prev) => {
      const phones = [...prev.phones];
      phones[index] = value;
      return { ...prev, phones };
    });
  };

  const addPhone = () => {
    setHospitalForm((prev) => ({ ...prev, phones: [...prev.phones, ''] }));
  };

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
            <Building2 className="text-primary-700 w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-primary-600 uppercase tracking-wider">Hospital Admin</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">{hospitalName || 'Hospital Dashboard'}</h1>
          </div>
        </div>
        <p className="text-gray-500 font-medium ml-16">Manage your hospital profile and approve registered doctors.</p>
      </div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner scrollbar-hide overflow-x-auto">
          <button onClick={() => setActiveTab('emergencies')}
            className={`flex-none px-4 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center whitespace-nowrap ${activeTab === 'emergencies' ? 'bg-red-500 shadow-sm text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
            <AlertTriangle className="w-4 h-4 mr-2" /> Emergencies <span className="ml-2 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">2</span>
          </button>
          <button onClick={() => setActiveTab('doctors')}
            className={`flex-none px-4 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center whitespace-nowrap ${activeTab === 'doctors' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Stethoscope className="w-4 h-4 mr-2" /> Doctors {(approvedDoctors.length > 0) && <span className="ml-2 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{approvedDoctors.length}</span>}
          </button>
          <button onClick={() => setActiveTab('appointments')}
            className={`flex-none px-4 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center whitespace-nowrap ${activeTab === 'appointments' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Clock className="w-4 h-4 mr-2" /> Bookings {(appointments.length > 0) && <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{appointments.length}</span>}
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`flex-none px-4 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center whitespace-nowrap ${activeTab === 'requests' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Shield className="w-4 h-4 mr-2" /> Requests {(pendingDoctors.length > 0) && <span className="ml-2 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{pendingDoctors.length}</span>}
          </button>
          <button onClick={() => setActiveTab('profile')}
            className={`flex-none px-4 py-3 text-sm font-bold rounded-lg transition-all flex justify-center items-center whitespace-nowrap ${activeTab === 'profile' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:bg-gray-200'}`}>
            <Building2 className="w-4 h-4 mr-2" /> Profile
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Emergency Command Center Tab ── */}
        {activeTab === 'emergencies' && (
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-red-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 to-red-700"></div>

            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-1 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-red-500" /> Active Emergencies
                </h3>
                <p className="text-sm text-gray-500">Live incoming ICU bed requests and inbound ambulances.</p>
              </div>
              <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-center">
                <p className="text-[10px] font-black uppercase text-red-500 tracking-wider">ICU Beds Available</p>
                <p className="text-2xl font-black text-red-700 leading-none mt-1">{hospitalForm.icuBeds || 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mock Emergency 1 */}
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider animate-pulse">ICU BED REQUEST</span>
                    <span className="text-xs font-bold text-gray-400">Just now</span>
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Patient Name: Rahul Verma</h4>
                  <p className="text-sm text-gray-600 mt-1"><PhoneCall className="w-3.5 h-3.5 inline mr-1" /> +91 98765 43210</p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-xl transition-all shadow-sm">Reserve & Confirm</button>
                  <button className="px-4 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold py-2 rounded-xl transition-all">Decline</button>
                </div>
              </div>

              {/* Mock Emergency 2 */}
              <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider">INBOUND AMBULANCE</span>
                    <span className="text-xs font-bold text-gray-400">2 mins ago</span>
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-lg">Ambulance Dispatch #442</h4>
                  <p className="text-sm text-gray-600 mt-1"><PlusSquare className="w-3.5 h-3.5 inline mr-1" /> Driver: Sameer • ETA: 6 mins</p>
                </div>
                <div className="mt-5 flex gap-2">
                  <button className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl transition-all shadow-sm">Acknowledge Arrival</button>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-center text-gray-400 mt-6 pt-4 border-t border-gray-100">Live emergency requests stream directly to this dashboard. Keep availability numbers updated.</p>
          </section>
        )}

        {/* ── Pending Approvals Tab ── */}
        {activeTab === 'requests' && (
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-orange-500"></div>

            <h3 className="text-xl font-extrabold text-gray-900 mb-1 flex items-center">
              Doctor Verification Requests
            </h3>
            <p className="text-sm text-gray-500 mb-6">Doctors who listed your hospital during their onboarding will show here. Approve them to grant dashboard access.</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : pendingDoctors.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No pending verification requests.</p>
                <p className="text-gray-400 text-xs mt-1">When a doctor enters "{hospitalName}" as their working hospital, they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingDoctors.map(doc => (
                  <div key={doc.id} className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-sm text-amber-600 font-bold text-lg">
                        {doc.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Dr. {doc.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.specialization || 'Specialization not set'} &bull; License: {doc.license_number || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {doc.proof_url && (
                        <a href={doc.proof_url} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-white text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition border border-gray-200">
                          Proof
                        </a>
                      )}
                      <button onClick={() => handleApproval(doc.id, true)}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                      </button>
                      <button onClick={() => handleApproval(doc.id, false)}
                        className="flex items-center px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition border border-red-200">
                        <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Approved Doctors Tab ── */}
        {activeTab === 'doctors' && (
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-400 to-emerald-500"></div>

            <h3 className="text-xl font-extrabold text-gray-900 mb-1 flex items-center">
              Active Doctors
            </h3>
            <p className="text-sm text-gray-500 mb-6">Fully approved doctors who are affiliated with your hospital.</p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : approvedDoctors.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <Stethoscope className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No active doctors yet.</p>
                <p className="text-gray-400 text-xs mt-1">Approve pending requests to add doctors to your roster.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {approvedDoctors.map(doc => (
                  <div key={doc.id} className="bg-green-50 rounded-2xl p-4 border border-green-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-sm text-green-600 font-bold text-lg">
                        {doc.full_name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Dr. {doc.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.specialization || 'Specialization not set'} &bull; License: {doc.license_number || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => generateSlots(doc.id)}
                        disabled={generatingFor === doc.id}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border
                          ${generatingFor === doc.id
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-primary-50 text-primary-700 border-primary-100 hover:bg-primary-100'}`}
                      >
                        <CalendarPlus className="w-3.5 h-3.5 mr-1" />
                        {generatingFor === doc.id ? 'Generating...' : 'Slots'}
                      </button>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">Active</span>
                      <button onClick={() => handleApproval(doc.id, false)}
                        className="flex items-center px-3 py-1.5 bg-white text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-50 transition border border-red-200">
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Appointments View Tab ── */}
        {activeTab === 'appointments' && (
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-1 flex items-center">
                  Hospital Bookings
                </h3>
                <p className="text-sm text-gray-500">Real-time view of all patient appointments at your hospital.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No appointments booked yet.</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3">Token</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {appointments.map(apt => (
                      <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 font-black text-gray-900">{apt.token_number}</td>
                        <td className="px-4 py-4 font-medium text-gray-700">{apt.patient?.full_name}</td>
                        <td className="px-4 py-4 text-primary-600 font-bold">{apt.doctor?.full_name || 'N/A'}</td>
                        <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                          {apt.hospital_slots?.slot_date} &bull; {apt.hospital_slots?.start_time.substring(0, 5)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                          ${apt.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {apt.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Hospital Profile Tab ── */}
        {activeTab === 'profile' && (
          <section className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-400 to-primary-600"></div>

            <h3 className="text-xl font-extrabold text-gray-900 mb-6 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-primary-500" /> Hospital Information
            </h3>

            <form onSubmit={handleSaveHospital} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Hospital / Centre Name</label>
                  <input type="text" required value={hospitalForm.name} onChange={(e) => setHospitalForm({ ...hospitalForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-red-500 mb-1.5 uppercase tracking-wide">Live ICU Beds Available</label>
                  <input type="number" min="0" required value={hospitalForm.icuBeds} onChange={(e) => setHospitalForm({ ...hospitalForm, icuBeds: e.target.value })}
                    className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm font-bold text-red-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-red-300" 
                    placeholder="e.g. 5" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Registration Email</label>
                  <input type="email" value={hospitalForm.email} onChange={(e) => setHospitalForm({ ...hospitalForm, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Description</label>
                <textarea value={hospitalForm.description} onChange={(e) => setHospitalForm({ ...hospitalForm, description: e.target.value })} rows="3"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Address</label>
                  <input type="text" value={hospitalForm.address} onChange={(e) => setHospitalForm({ ...hospitalForm, address: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">City</label>
                  <input type="text" value={hospitalForm.city} onChange={(e) => setHospitalForm({ ...hospitalForm, city: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">State / Region</label>
                  <input type="text" value={hospitalForm.state} onChange={(e) => setHospitalForm({ ...hospitalForm, state: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
              </div>

              {/* Dynamic Phones */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <h4 className="text-sm font-bold text-gray-700 flex items-center mb-4"><Phone className="w-4 h-4 mr-2" /> Contact Numbers</h4>
                <div className="space-y-3">
                  {hospitalForm.phones.map((phone, index) => (
                    <input key={index} type="tel" value={phone} onChange={(e) => updatePhone(index, e.target.value)} placeholder={`Phone Line ${index + 1}`}
                      className="w-full md:w-1/2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all" />
                  ))}
                </div>
                <button type="button" onClick={addPhone} className="mt-4 flex items-center text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-2 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Phone Line
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Map Latitude</label>
                  <input type="text" value={hospitalForm.lat} onChange={(e) => setHospitalForm({ ...hospitalForm, lat: e.target.value })} placeholder="e.g. 19.0760"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Map Longitude</label>
                  <input type="text" value={hospitalForm.lng} onChange={(e) => setHospitalForm({ ...hospitalForm, lng: e.target.value })} placeholder="e.g. 72.8777"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all" />
                </div>
              </div>

              {status && (
                <div className={`p-4 rounded-xl text-sm font-bold border ${status.includes('success') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {status}
                </div>
              )}

              <button type="submit" disabled={saving}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-extrabold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center">
                {saving ? 'Saving...' : 'Save Hospital Profile'}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
};

export default HospitalDashboard;
