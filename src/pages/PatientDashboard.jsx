import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Clock, User, Heart, Search, Video, FileText } from 'lucide-react';
import { format } from 'date-fns';

const PatientDashboard = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse', 'appointments', 'records'

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch doctors
      const { data: docsData, error: docsError } = await supabase
        .from('doctors')
        .select('*')
        .eq('is_approved', true);
      
      // Fetch user's appointments
      const { data: aptsData, error: aptsError } = await supabase
        .from('appointments')
        .select(`
          id,
          status,
          created_at,
          slots (
            start_time
          ),
          doctor:doctors!appointments_doctor_id_fkey (
            full_name,
            specialization,
            hospital_name
          )
        `)
        .eq('patient_id', user.id);

      if (docsError) throw docsError;
      if (aptsError) throw aptsError;

      setDoctors(docsData || []);
      setAppointments(aptsData || []);
    } catch (err) {
      console.error("Error fetching patient data", err);
    } finally {
      setLoading(false);
    }
  };

  const bookSlot = async (doctorId) => {
    // Basic mock implementation for slot booking since picking a real slot needs more UI
    alert("This would typically open a calendar to pick slots for Dr. " + doctorId);
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patient Analytics & Access</h1>
          <p className="text-gray-500 mt-1">Manage your health consultations effortlessly</p>
        </div>
        <div className="mt-4 sm:mt-0 flex bg-gray-100 p-1 rounded-xl">
          {['browse', 'appointments', 'records'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'browse' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="relative max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm hover:shadow-sm transition-all"
              placeholder="Search doctors, specialties, or hospitals..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map(doc => (
              <div key={doc.id} className="card p-6 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                  <User className="h-10 w-10 text-primary-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Dr. {doc.full_name}</h3>
                <p className="text-sm font-medium text-primary-600 mt-1">{doc.specialization || 'General Practitioner'}</p>
                <p className="text-sm text-gray-500 mt-1">{doc.hospital_name || 'Independent Clinic'}</p>
                
                <button 
                  onClick={() => bookSlot(doc.id)}
                  className="mt-6 w-full btn-primary"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" /> Book Appointment
                </button>
              </div>
            ))}
            {doctors.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                No doctors registered yet.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="card p-0 animate-fade-in-up">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {appointments.map(apt => (
                <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                    <Clock className="w-4 h-4 text-gray-400 mr-2" />
                    {apt.slots?.start_time ? format(new Date(apt.slots.start_time), 'PPp') : 'Unscheduled'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">Dr. {apt.doctor?.full_name}</div>
                    <div className="text-sm text-gray-500">{apt.doctor?.specialization}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${apt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 flex items-center justify-end w-full">
                      <Video className="w-4 h-4 mr-1" /> Join Call
                    </button>
                  </td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500 text-sm">
                    No appointments booked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="card p-12 text-center animate-fade-in-up">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Health Records</h3>
          <p className="text-sm text-gray-500">Your health prescriptions and AI diagnostics will appear here once consultations are complete.</p>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
