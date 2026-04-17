import React, { useState, useEffect } from 'react';
import {
  History, Loader2, Calendar, Clock, ChevronDown, ChevronUp, ClipboardList,
  Stethoscope, Pill, Activity, Heart, Thermometer, TrendingUp, Droplets
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

const Records = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Report viewing in history
  const [selectedHistoryApt, setSelectedHistoryApt] = useState(null);
  const [historyReports, setHistoryReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  // ── Fetch history ──
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, status, token_number, created_at,
          hospital:hospital_admins(full_name),
          doctor:doctors(full_name),
          hospital_slots(slot_date, start_time, end_time)
        `)
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });
      setHistory(data || []);
    } catch (err) { 
      console.error('fetchHistory:', err); 
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch reports for a specific appointment ──
  const openAppointmentReports = async (apt) => {
    if (selectedHistoryApt?.id === apt.id) {
      setSelectedHistoryApt(null);
      setHistoryReports([]);
      return;
    }
    setSelectedHistoryApt(apt);
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('patient_reports')
        .select(`
          *,
          doctor:doctors(full_name, specialization)
        `)
        .eq('appointment_id', apt.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryReports(data || []);
    } catch (err) {
      console.error('fetchReports:', err);
      setHistoryReports([]);
    } finally {
      setReportsLoading(false);
    }
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

  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-6 bg-gray-50">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-8 pb-5">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Medical Records</h1>
          <p className="text-xs text-gray-400 font-medium">View your past visits and clinical progress reports</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5">
        <div className="animate-fade-in-up space-y-3 pb-10">
          {loading && <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-primary-500 animate-spin" /></div>}

          {!loading && history.length === 0 && (
            <div className="bg-white p-8 rounded-2xl text-center border border-gray-100 mt-4">
              <History className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-900 mb-1 text-sm">No Past Visits</h3>
              <p className="text-gray-400 text-xs">Your medical history will appear here once you visit.</p>
            </div>
          )}

          {!loading && history.map(apt => {
            const isExpanded = selectedHistoryApt?.id === apt.id;
            return (
              <div key={apt.id} className={`bg-white rounded-2xl shadow-sm border transition-all relative overflow-hidden
                ${isExpanded ? 'border-primary-200 shadow-md' : 'border-gray-100 hover:border-primary-100'}`}>
                
                {/* Status bar */}
                <div className={`absolute top-0 left-0 w-1 h-full ${apt.status === 'confirmed' ? 'bg-primary-500' : apt.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
                
                {/* Card header — clickable */}
                <div className="p-4 cursor-pointer" onClick={() => openAppointmentReports(apt)}>
                  <div className="flex justify-between items-start mb-2 ml-3">
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-sm">{apt.token_number || 'Token'}</h3>
                      <p className="text-gray-400 text-xs font-medium">{apt.hospital?.full_name}</p>
                      {apt.doctor && <p className="text-primary-600 text-[10px] font-bold mt-0.5">Dr. {apt.doctor.full_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold
                        ${apt.status === 'confirmed' ? 'bg-primary-50 text-primary-700' : apt.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {apt.status}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>
                  <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-50 p-2.5 rounded-lg ml-3 gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary-500" />
                      {apt.hospital_slots?.slot_date && format(new Date(apt.hospital_slots.slot_date + 'T00:00:00'), 'EEE, MMM do')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-primary-500" />
                      {apt.hospital_slots?.start_time?.substring(0, 5)}
                    </span>
                    <span className="ml-auto text-[10px] text-primary-600 font-bold flex items-center gap-0.5">
                      <ClipboardList className="w-3 h-3" /> View Reports
                    </span>
                  </div>
                </div>

                {/* ── Expanded Reports Section ── */}
                {isExpanded && (
                  <div className="px-4 pb-4 ml-3 space-y-3 animate-fade-in-up border-t border-gray-50 pt-3">
                    {reportsLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                      </div>
                    ) : historyReports.length === 0 ? (
                      <div className="bg-gray-50 p-5 rounded-xl text-center">
                        <ClipboardList className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500 font-medium">No reports or prescriptions for this visit yet.</p>
                      </div>
                    ) : (
                      historyReports.map(report => {
                        const badge = reportTypeBadge(report.report_type);
                        return (
                          <div key={report.id} className="border border-gray-100 rounded-xl p-4 bg-white space-y-3 shadow-sm">
                            {/* Report header */}
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold capitalize border ${badge.bg} ${badge.text} ${badge.border}`}>
                                    {report.report_type?.replace('_', ' ')}
                                  </span>
                                  <span className="text-[10px] text-gray-400">
                                    {format(new Date(report.created_at), 'MMM do yyyy, h:mm a')}
                                  </span>
                                </div>
                                {report.doctor && (
                                  <p className="text-[10px] text-primary-600 font-bold mt-1 flex items-center gap-1">
                                    <Stethoscope className="w-2.5 h-2.5" /> Dr. {report.doctor.full_name}
                                    {report.doctor.specialization && <span className="text-gray-400 font-normal ml-1">({report.doctor.specialization})</span>}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Vitals */}
                            {(report.blood_pressure || report.heart_rate || report.temperature || report.weight || report.spo2) && (
                              <div className="grid grid-cols-3 gap-2">
                                {report.blood_pressure && (
                                  <div className="bg-red-50 p-2 rounded-lg text-center">
                                    <Heart className="w-3 h-3 text-red-500 mx-auto mb-0.5" />
                                    <p className="text-[10px] font-bold text-gray-900">{report.blood_pressure}</p>
                                    <p className="text-[8px] text-gray-400">BP</p>
                                  </div>
                                )}
                                {report.heart_rate && (
                                  <div className="bg-pink-50 p-2 rounded-lg text-center">
                                    <Activity className="w-3 h-3 text-pink-500 mx-auto mb-0.5" />
                                    <p className="text-[10px] font-bold text-gray-900">{report.heart_rate} bpm</p>
                                    <p className="text-[8px] text-gray-400">Pulse</p>
                                  </div>
                                )}
                                {report.temperature && (
                                  <div className="bg-orange-50 p-2 rounded-lg text-center">
                                    <Thermometer className="w-3 h-3 text-orange-500 mx-auto mb-0.5" />
                                    <p className="text-[10px] font-bold text-gray-900">{report.temperature}°F</p>
                                    <p className="text-[8px] text-gray-400">Temp</p>
                                  </div>
                                )}
                                {report.weight && (
                                  <div className="bg-blue-50 p-2 rounded-lg text-center">
                                    <TrendingUp className="w-3 h-3 text-blue-500 mx-auto mb-0.5" />
                                    <p className="text-[10px] font-bold text-gray-900">{report.weight} kg</p>
                                    <p className="text-[8px] text-gray-400">Weight</p>
                                  </div>
                                )}
                                {report.spo2 && (
                                  <div className="bg-cyan-50 p-2 rounded-lg text-center">
                                    <Droplets className="w-3 h-3 text-cyan-500 mx-auto mb-0.5" />
                                    <p className="text-[10px] font-bold text-gray-900">{report.spo2}%</p>
                                    <p className="text-[8px] text-gray-400">SpO2</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Symptoms */}
                            {report.symptoms && (
                              <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Symptoms</h5>
                                <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg">{report.symptoms}</p>
                              </div>
                            )}

                            {/* Diagnosis */}
                            {report.diagnosis && (
                              <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Diagnosis</h5>
                                <p className="text-xs text-gray-900 bg-gray-50 p-2.5 rounded-lg font-medium">{report.diagnosis}</p>
                              </div>
                            )}

                            {/* Prescription */}
                            {report.prescription && (
                              <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mb-1 flex items-center gap-1">
                                  <Pill className="w-3 h-3" /> Prescription
                                </h5>
                                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                                  <p className="text-xs text-gray-800 whitespace-pre-wrap">{report.prescription}</p>
                                </div>
                              </div>
                            )}

                            {/* Doctor's Notes */}
                            {report.notes && (
                              <div>
                                <h5 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Doctor's Notes</h5>
                                <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg whitespace-pre-wrap">{report.notes}</p>
                              </div>
                            )}

                            {/* Follow-up */}
                            {report.follow_up_date && (
                              <div className="bg-primary-50 p-3 rounded-xl flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary-600" />
                                <span className="text-xs font-bold text-primary-700">
                                  Follow-up: {format(new Date(report.follow_up_date), 'EEEE, MMM do yyyy')}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Records;
