import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Users, Calendar, Clock, PlusCircle, Building2, CheckCircle, XCircle,
  Filter, FileText, ChevronRight, X, User as UserIcon, Stethoscope,
  Pill, Activity, Heart, Thermometer, Droplets, Wind, ClipboardList,
  TrendingUp, AlertCircle, Save, Eye, ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import { format, addDays } from 'date-fns';

const DoctorDashboard = () => {
  const { user, profile } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const hasOnboarded = user?.user_metadata?.license_number;
  const [onboardingData, setOnboardingData] = useState({ license_number: '', specialization: '', hospital_name: '' });
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [hospitals, setHospitals] = useState([]); // Needed to easily get a hospital ID for generating slots if needed
  const [loading, setLoading] = useState(true);
  const [selectedPatientApt, setSelectedPatientApt] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientReports, setPatientReports] = useState([]);
  const [generatingFor, setGeneratingFor] = useState(null);
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'reports'
  const [filterStatus, setFilterStatus] = useState('all');

  // Report/Prescription form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportForm, setReportForm] = useState({
    diagnosis: '',
    symptoms: '',
    notes: '',
    prescription: '',
    follow_up_date: '',
    blood_pressure: '',
    heart_rate: '',
    temperature: '',
    weight: '',
    spo2: '',
    report_type: 'progress',
  });

  // View report detail
  const [viewingReport, setViewingReport] = useState(null);
  const [allReports, setAllReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    if (hasOnboarded) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user, hasOnboarded]);

  const fetchData = async () => {
    try {
      // Fetch ALL appointments across ALL hospitals
      const { data: aptsData, error: aptsError } = await supabase
        .from('appointments')
        .select(`
          id, status, token_number, created_at, patient_id,
          patient:patients(id, full_name, phone, age, blood_group),
          hospital:hospital_admins(id, full_name),
          hospital_slots(slot_date, start_time, end_time)
        `)
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch all hospitals
      const { data: hospData, error: hospError } = await supabase
        .from('hospital_admins')
        .select('*');

      if (aptsError) throw aptsError;
      if (hospError) throw hospError;

      setAppointments(aptsData || []);
      setHospitals(hospData || []);
    } catch (err) {
      console.error("Error fetching doctor data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReports = async () => {
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_reports')
        .select(`
          *,
          patient:patients(id, full_name, phone, age, blood_group),
          appointment:appointments(token_number, status,
            hospital_slots(slot_date, start_time)
          )
        `)
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllReports(data || []);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const updateStatus = async (aptId, newStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', aptId);
      if (error) throw error;
      setAppointments(prev => prev.map(a => a.id === aptId ? { ...a, status: newStatus } : a));
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  };

  const openPatientDetails = async (apt) => {
    setSelectedPatientApt(apt);
    setShowReportForm(false);
    setViewingReport(null);
    resetReportForm();
    try {
      // Fetch appointment history
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, token_number, created_at,
          hospital_admins(full_name),
          hospital_slots(slot_date)
        `)
        .eq('patient_id', apt.patient_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPatientHistory(data || []);

      // Fetch patient reports/prescriptions
      const { data: reports, error: reportsErr } = await supabase
        .from('patient_reports')
        .select('*')
        .eq('patient_id', apt.patient_id)
        .order('created_at', { ascending: false });
      if (reportsErr) throw reportsErr;
      setPatientReports(reports || []);
    } catch (err) {
      console.error(err);
    }
  };

  const resetReportForm = () => {
    setReportForm({
      diagnosis: '',
      symptoms: '',
      notes: '',
      prescription: '',
      follow_up_date: '',
      blood_pressure: '',
      heart_rate: '',
      temperature: '',
      weight: '',
      spo2: '',
      report_type: 'progress',
    });
  };

  const saveReport = async () => {
    if (!selectedPatientApt) return;
    if (!reportForm.diagnosis && !reportForm.prescription) {
      alert('Please fill in at least a diagnosis or prescription.');
      return;
    }
    setReportSaving(true);
    try {
      const payload = {
        appointment_id: selectedPatientApt.id,
        patient_id: selectedPatientApt.patient_id,
        doctor_id: user.id,
        hospital_id: selectedPatientApt.hospital?.id || null,
        diagnosis: reportForm.diagnosis || null,
        symptoms: reportForm.symptoms || null,
        notes: reportForm.notes || null,
        prescription: reportForm.prescription || null,
        follow_up_date: reportForm.follow_up_date || null,
        blood_pressure: reportForm.blood_pressure || null,
        heart_rate: reportForm.heart_rate ? parseInt(reportForm.heart_rate) : null,
        temperature: reportForm.temperature ? parseFloat(reportForm.temperature) : null,
        weight: reportForm.weight ? parseFloat(reportForm.weight) : null,
        spo2: reportForm.spo2 ? parseInt(reportForm.spo2) : null,
        report_type: reportForm.report_type,
      };

      const { data, error } = await supabase
        .from('patient_reports')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setPatientReports(prev => [data, ...prev]);
      setShowReportForm(false);
      resetReportForm();
      alert('Report saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save report: ' + err.message);
    } finally {
      setReportSaving(false);
    }
  };

  const generateSlots = async (hospitalId) => {
    if (!hospitalId) {
      alert("No hospital associated with your profile.");
      return;
    }
    setGeneratingFor(hospitalId);
    try {
      const slotsToInsert = [];
      for (let d = 0; d <= 7; d++) {
        const dateObj = addDays(new Date(), d);
        const dateStr = format(dateObj, 'yyyy-MM-dd');
        
        // Generate 30 mins slots from 9am to 5pm (last slot starts at 16:30)
        for (let h = 9; h < 17; h++) {
          const hour = h.toString().padStart(2, '0');
          // :00 slot
          slotsToInsert.push({ 
            hospital_id: hospitalId, 
            doctor_id: user.id,
            slot_date: dateStr, 
            start_time: `${hour}:00:00`, 
            end_time: `${hour}:30:00` 
          });
          // :30 slot
          slotsToInsert.push({ 
            hospital_id: hospitalId, 
            doctor_id: user.id,
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
      alert('Success! Your appointment slots for the next 7 days have been generated.');
    } catch (err) {
      console.error(err);
      alert('Failed to generate slots: ' + err.message);
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setOnboardingLoading(true);
    try {
      // 1. Save to user_metadata for local access
      const { error } = await supabase.auth.updateUser({
        data: {
          license_number: onboardingData.license_number,
          specialization: onboardingData.specialization,
          hospital_name: onboardingData.hospital_name,
        }
      });
      if (error) throw error;

      // 2. Also save to doctors table so hospital can query and approve
      const { error: profileErr } = await supabase.from('doctors').update({
        hospital_name: onboardingData.hospital_name,
        specialization: onboardingData.specialization,
        license_number: onboardingData.license_number,
        is_approved: false, // Requires hospital approval
      }).eq('id', user.id);

      if (profileErr) {
        console.warn('Profile update note:', profileErr.message);
      }

      alert('Your credentials have been submitted! Your hospital must approve your account before you can access the dashboard. You will be signed out now.');
      
      // Sign them out since they need hospital approval
      setUser(null);
      setProfile(null);
      localStorage.clear();
      sessionStorage.clear();
      supabase.auth.signOut().catch(() => {});
      window.location.href = '/auth';
    } catch (err) {
      alert(err.message);
      setOnboardingLoading(false);
    }
  };

  // ── Filter logic ──
  const filteredAppointments = filterStatus === 'all'
    ? appointments
    : appointments.filter(a => a.status === filterStatus);

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };

  // ── Report type badge color ──
  const reportTypeBadge = (type) => {
    const map = {
      progress: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
      follow_up: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
      discharge: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
      lab_result: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    };
    return map[type] || map.progress;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!hasOnboarded) {
    return (
      <div className="max-w-xl mx-auto mt-10 px-4">
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
          <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-6">
            <UserIcon className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Welcome, Dr. {profile?.full_name}!</h2>
          <p className="text-sm text-gray-500 mb-8">Please provide your professional credentials to activate your dashboard.</p>
          
          <form onSubmit={handleOnboardingSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Medical License Number</label>
              <input required type="text" value={onboardingData.license_number} onChange={e => setOnboardingData({...onboardingData, license_number: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" placeholder="e.g. MED-12345678" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Primary Specialization</label>
              <input required type="text" value={onboardingData.specialization} onChange={e => setOnboardingData({...onboardingData, specialization: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" placeholder="e.g. Cardiologist, General Physician" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Current Hospital / Clinic</label>
              <input required type="text" value={onboardingData.hospital_name} onChange={e => setOnboardingData({...onboardingData, hospital_name: e.target.value})} 
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all" placeholder="Enter Hospital Name" />
            </div>
            
            <button type="submit" disabled={onboardingLoading} className="w-full mt-6 bg-primary-600 text-white rounded-xl px-4 py-3.5 text-sm font-bold shadow-md hover:bg-primary-700 transition flex justify-center items-center">
              {onboardingLoading ? 'Saving...' : 'Activate Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
            <Users className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Dr. {profile?.full_name}</h1>
            <p className="text-xs text-gray-500">My Appointments & Patient Reports</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-primary-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-primary-700">{stats.total}</p>
            <p className="text-[10px] font-bold text-primary-600">Total</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-blue-700">{stats.confirmed}</p>
            <p className="text-[10px] font-bold text-blue-600">Active</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-green-700">{stats.completed}</p>
            <p className="text-[10px] font-bold text-green-600">Done</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-xl font-black text-red-700">{stats.cancelled}</p>
            <p className="text-[10px] font-bold text-red-600">Cancelled</p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-gray-100 p-1 rounded-xl flex">
        <button
          onClick={() => setActiveTab('appointments')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5
            ${activeTab === 'appointments' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
        >
          <Calendar className="w-3.5 h-3.5" /> Appointments
        </button>
        <button
          onClick={() => { setActiveTab('reports'); fetchAllReports(); }}
          className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5
            ${activeTab === 'reports' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500'}`}
        >
          <ClipboardList className="w-3.5 h-3.5" /> Patient Reports
        </button>
      </div>

      {/* ══════════════════════════
          APPOINTMENTS TAB
      ══════════════════════════ */}
      {activeTab === 'appointments' && (
        <>
          <div className="flex items-center justify-between">
            {/* Status Filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {['all', 'confirmed', 'completed', 'cancelled'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all whitespace-nowrap
                    ${filterStatus === s ? 'bg-primary-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-primary-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>

            {hospitals.find(h => h.full_name === (profile?.hospital_name || user?.user_metadata?.hospital_name)) && (
              <button 
                onClick={() => generateSlots(hospitals.find(h => h.full_name === (profile?.hospital_name || user?.user_metadata?.hospital_name))?.id)} 
                disabled={generatingFor}
                className={`flex items-center px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-sm shrink-0 ml-2
                  ${generatingFor ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" /> 
                {generatingFor ? 'Generating...' : 'Generate Slots'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {filteredAppointments.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center border border-gray-100">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No {filterStatus !== 'all' ? filterStatus : ''} appointments found.</p>
              </div>
            ) : (
              filteredAppointments.map(apt => (
                <div key={apt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-primary-200 transition-colors cursor-pointer" onClick={() => openPatientDetails(apt)}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm">{apt.token_number}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                          ${apt.status === 'confirmed' ? 'bg-primary-50 text-primary-700' : apt.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Patient: <b>{apt.patient?.full_name}</b></p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <button className="mt-1 text-[10px] text-primary-600 flex items-center font-bold">
                        View details <ChevronRight className="w-3 h-3 ml-0.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-2.5 flex items-center text-xs text-gray-600 font-medium mb-3">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
                    {apt.hospital_slots?.slot_date && format(new Date(apt.hospital_slots.slot_date), 'EEE, MMM do')} • {apt.hospital_slots?.start_time?.substring(0,5)}
                  </div>

                  {apt.status === 'confirmed' && (
                    <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'completed'); }}
                        className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold flex items-center justify-center hover:bg-green-100 transition-colors">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'cancelled'); }}
                        className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold flex items-center justify-center hover:bg-red-100 transition-colors">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════
          PATIENT REPORTS TAB
      ══════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-3 animate-fade-in-up">
          {reportsLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : allReports.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl text-center border border-gray-100">
              <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 mb-1">No Reports Yet</h3>
              <p className="text-gray-400 text-xs">Click on a patient from Appointments to write your first report.</p>
            </div>
          ) : (
            allReports.map(report => {
              const badge = reportTypeBadge(report.report_type);
              return (
                <div key={report.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-primary-200 transition-all cursor-pointer"
                  onClick={() => setViewingReport(viewingReport?.id === report.id ? null : report)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{report.patient?.full_name}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {format(new Date(report.created_at), 'MMM do yyyy, h:mm a')}
                          {report.appointment?.token_number && ` • ${report.appointment.token_number}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {report.report_type?.replace('_', ' ')}
                          </span>
                          {report.diagnosis && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[180px]">
                              {report.diagnosis}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {viewingReport?.id === report.id
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>

                  {/* Expanded Report Detail */}
                  {viewingReport?.id === report.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                      {/* Vitals */}
                      {(report.blood_pressure || report.heart_rate || report.temperature || report.weight || report.spo2) && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2 flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Vitals
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {report.blood_pressure && (
                              <div className="bg-red-50 p-2.5 rounded-xl text-center">
                                <Heart className="w-3.5 h-3.5 text-red-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-900">{report.blood_pressure}</p>
                                <p className="text-[9px] text-gray-400">BP</p>
                              </div>
                            )}
                            {report.heart_rate && (
                              <div className="bg-pink-50 p-2.5 rounded-xl text-center">
                                <Activity className="w-3.5 h-3.5 text-pink-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-900">{report.heart_rate} bpm</p>
                                <p className="text-[9px] text-gray-400">Pulse</p>
                              </div>
                            )}
                            {report.temperature && (
                              <div className="bg-orange-50 p-2.5 rounded-xl text-center">
                                <Thermometer className="w-3.5 h-3.5 text-orange-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-900">{report.temperature}°F</p>
                                <p className="text-[9px] text-gray-400">Temp</p>
                              </div>
                            )}
                            {report.weight && (
                              <div className="bg-blue-50 p-2.5 rounded-xl text-center">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-900">{report.weight} kg</p>
                                <p className="text-[9px] text-gray-400">Weight</p>
                              </div>
                            )}
                            {report.spo2 && (
                              <div className="bg-cyan-50 p-2.5 rounded-xl text-center">
                                <Droplets className="w-3.5 h-3.5 text-cyan-500 mx-auto mb-1" />
                                <p className="text-xs font-bold text-gray-900">{report.spo2}%</p>
                                <p className="text-[9px] text-gray-400">SpO2</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {report.symptoms && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Symptoms</h4>
                          <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl">{report.symptoms}</p>
                        </div>
                      )}
                      {report.diagnosis && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Diagnosis</h4>
                          <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl font-medium">{report.diagnosis}</p>
                        </div>
                      )}
                      {report.prescription && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mb-1 flex items-center gap-1">
                            <Pill className="w-3 h-3" /> Prescription
                          </h4>
                          <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                            <p className="text-xs text-gray-800 whitespace-pre-wrap">{report.prescription}</p>
                          </div>
                        </div>
                      )}
                      {report.notes && (
                        <div>
                          <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Doctor's Notes</h4>
                          <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap">{report.notes}</p>
                        </div>
                      )}
                      {report.follow_up_date && (
                        <div className="bg-primary-50 p-3 rounded-xl flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary-600" />
                          <span className="text-xs font-bold text-primary-700">
                            Follow-up: {format(new Date(report.follow_up_date), 'EEEE, MMM do yyyy')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          PATIENT DETAILS + REPORT MODAL
      ══════════════════════════════════════════ */}
      {selectedPatientApt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-extrabold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary-600" /> Patient Details
              </h2>
              <button onClick={() => setSelectedPatientApt(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Profile Info */}
              <div className="flex items-center gap-4 bg-primary-50 p-4 rounded-2xl">
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm text-primary-600">
                  <UserIcon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">{selectedPatientApt.patient?.full_name}</h3>
                  <p className="text-sm text-gray-600 font-medium">{selectedPatientApt.patient?.phone || 'No phone provided'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Age</p>
                  <p className="font-bold text-gray-900">{selectedPatientApt.patient?.age || 'N/A'}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Blood Group</p>
                  <p className="font-bold text-gray-900">{selectedPatientApt.patient?.blood_group || 'N/A'}</p>
                </div>
              </div>

              {/* ── Write Report / Prescription Button ── */}
              <button
                onClick={() => setShowReportForm(!showReportForm)}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                  ${showReportForm
                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md hover:shadow-lg hover:from-primary-700 hover:to-primary-800'
                  }`}
              >
                {showReportForm ? (
                  <><X className="w-4 h-4" /> Cancel Report</>
                ) : (
                  <><PlusCircle className="w-4 h-4" /> Write Report / Prescription</>
                )}
              </button>

              {/* ══════════════════════════════
                  REPORT / PRESCRIPTION FORM
              ══════════════════════════════ */}
              {showReportForm && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-4 animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-1">
                    <Stethoscope className="w-4 h-4 text-primary-600" />
                    <h4 className="font-bold text-gray-900 text-sm">New Progress Report</h4>
                  </div>

                  {/* Report Type */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Report Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'progress', label: 'Progress Note', icon: TrendingUp },
                        { value: 'follow_up', label: 'Follow-Up', icon: Calendar },
                        { value: 'discharge', label: 'Discharge', icon: CheckCircle },
                        { value: 'lab_result', label: 'Lab Result', icon: FileText },
                      ].map(rt => (
                        <button key={rt.value}
                          onClick={() => setReportForm({...reportForm, report_type: rt.value})}
                          className={`py-2 px-3 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all border
                            ${reportForm.report_type === rt.value
                              ? 'bg-primary-50 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-200 text-gray-500 hover:border-primary-200'
                            }`}
                        >
                          <rt.icon className="w-3 h-3" /> {rt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vitals Row */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5 flex items-center gap-1">
                      <Activity className="w-3 h-3" /> Vitals (Optional)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="BP (120/80)"
                        value={reportForm.blood_pressure}
                        onChange={e => setReportForm({...reportForm, blood_pressure: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="Pulse"
                        value={reportForm.heart_rate}
                        onChange={e => setReportForm({...reportForm, heart_rate: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Temp °F"
                        value={reportForm.temperature}
                        onChange={e => setReportForm({...reportForm, temperature: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="Weight (kg)"
                        value={reportForm.weight}
                        onChange={e => setReportForm({...reportForm, weight: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="SpO2 (%)"
                        value={reportForm.spo2}
                        onChange={e => setReportForm({...reportForm, spo2: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Symptoms */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Symptoms</label>
                    <textarea
                      rows={2}
                      placeholder="Chief complaints and symptoms..."
                      value={reportForm.symptoms}
                      onChange={e => setReportForm({...reportForm, symptoms: e.target.value})}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    />
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Diagnosis *</label>
                    <textarea
                      rows={2}
                      placeholder="Clinical diagnosis..."
                      value={reportForm.diagnosis}
                      onChange={e => setReportForm({...reportForm, diagnosis: e.target.value})}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    />
                  </div>

                  {/* Prescription */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-amber-600 mb-1.5 flex items-center gap-1">
                      <Pill className="w-3 h-3" /> Prescription *
                    </label>
                    <textarea
                      rows={4}
                      placeholder={"1. Medicine Name - Dosage - Duration\n2. Medicine Name - Dosage - Duration\n3. ..."}
                      value={reportForm.prescription}
                      onChange={e => setReportForm({...reportForm, prescription: e.target.value})}
                      className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none font-medium"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Doctor's Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Additional notes, advice, lifestyle recommendations..."
                      value={reportForm.notes}
                      onChange={e => setReportForm({...reportForm, notes: e.target.value})}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                    />
                  </div>

                  {/* Follow-up Date */}
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1.5">Follow-up Date</label>
                    <input
                      type="date"
                      value={reportForm.follow_up_date}
                      onChange={e => setReportForm({...reportForm, follow_up_date: e.target.value})}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveReport}
                    disabled={reportSaving}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {reportSaving ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save Report & Prescription</>
                    )}
                  </button>
                </div>
              )}

              {/* ── Past Reports for This Patient ── */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                  <ClipboardList className="w-4 h-4 mr-1.5 text-primary-600" /> Progress Reports & Prescriptions
                </h4>

                {patientReports.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl text-center font-medium">
                    No reports yet for this patient.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {patientReports.map(report => {
                      const badge = reportTypeBadge(report.report_type);
                      return (
                        <div key={report.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm space-y-3">
                          {/* Report header */}
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border ${badge.bg} ${badge.text} ${badge.border}`}>
                                  {report.report_type?.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-gray-400">
                                  {format(new Date(report.created_at), 'MMM do yyyy')}
                                </span>
                              </div>
                              {report.diagnosis && (
                                <p className="font-bold text-sm text-gray-900 mt-1">{report.diagnosis}</p>
                              )}
                            </div>
                          </div>

                          {/* Vitals mini row */}
                          {(report.blood_pressure || report.heart_rate || report.temperature) && (
                            <div className="flex gap-2 flex-wrap">
                              {report.blood_pressure && (
                                <span className="px-2 py-1 bg-red-50 rounded-lg text-[9px] font-bold text-red-600 flex items-center gap-1">
                                  <Heart className="w-2.5 h-2.5" /> {report.blood_pressure}
                                </span>
                              )}
                              {report.heart_rate && (
                                <span className="px-2 py-1 bg-pink-50 rounded-lg text-[9px] font-bold text-pink-600 flex items-center gap-1">
                                  <Activity className="w-2.5 h-2.5" /> {report.heart_rate} bpm
                                </span>
                              )}
                              {report.temperature && (
                                <span className="px-2 py-1 bg-orange-50 rounded-lg text-[9px] font-bold text-orange-600 flex items-center gap-1">
                                  <Thermometer className="w-2.5 h-2.5" /> {report.temperature}°F
                                </span>
                              )}
                              {report.spo2 && (
                                <span className="px-2 py-1 bg-cyan-50 rounded-lg text-[9px] font-bold text-cyan-600 flex items-center gap-1">
                                  <Wind className="w-2.5 h-2.5" /> {report.spo2}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Prescription highlight */}
                          {report.prescription && (
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                              <p className="text-[10px] uppercase font-bold text-amber-600 mb-1 flex items-center gap-1">
                                <Pill className="w-3 h-3" /> Prescription
                              </p>
                              <p className="text-xs text-gray-800 whitespace-pre-wrap">{report.prescription}</p>
                            </div>
                          )}

                          {report.notes && (
                            <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg">{report.notes}</p>
                          )}

                          {report.follow_up_date && (
                            <div className="flex items-center gap-1.5 text-xs text-primary-600 font-bold">
                              <Calendar className="w-3 h-3" />
                              Follow-up: {format(new Date(report.follow_up_date), 'MMM do yyyy')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Appointment History ── */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3 flex items-center text-sm">
                  <Clock className="w-4 h-4 mr-1.5 text-gray-400" /> Visit History
                </h4>
                
                {patientHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl text-center font-medium">No previous history found.</p>
                ) : (
                  <div className="space-y-2">
                    {patientHistory.map(hist => (
                      <div key={hist.id} className="border border-gray-100 rounded-xl p-3 flex justify-between items-center bg-white shadow-sm">
                        <div>
                          <p className="font-bold text-sm text-gray-900">{hist.hospital_admins?.full_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {hist.hospital_slots?.slot_date ? format(new Date(hist.hospital_slots.slot_date), 'MMM do yyyy') : 'Unknown Date'}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase
                          ${hist.status === 'confirmed' ? 'bg-primary-50 text-primary-700' : hist.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {hist.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
              <button onClick={() => setSelectedPatientApt(null)} className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition">
                Close
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;
