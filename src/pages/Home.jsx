import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, FileText, Zap, PlusSquare, Users, Building2, UserCircle, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';

const Home = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === 0 ? 1 : 0));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Live Queue Tracker
  const [queueData, setQueueData] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(true);

  useEffect(() => {
    if (user) {
      fetchQueuePosition();
    }
  }, [user]);

  // Subscribe to realtime appointment changes for live queue updates
  useEffect(() => {
    if (!queueData?.hospital_id) return;

    const channel = supabase
      .channel('queue-tracker')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `hospital_id=eq.${queueData.hospital_id}`,
        },
        () => {
          // Recalculate queue position when any appointment at this hospital changes
          fetchQueuePosition();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queueData?.hospital_id]);

  // ── Fetch queue position for today's appointments ──
  const fetchQueuePosition = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get my confirmed appointments for today
      const { data: myApts, error: myErr } = await supabase
        .from('appointments')
        .select(`
          id, status, created_at, hospital_id, doctor_id, slot_id,
          hospital:hospital_admins(full_name),
          doctor:doctors(full_name),
          hospital_slots(slot_date, start_time)
        `)
        .eq('patient_id', user.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: true });

      if (myErr) throw myErr;

      // Filter to today's appointments
      const todayApts = (myApts || []).filter(a =>
        a.hospital_slots?.slot_date === today
      );

      if (todayApts.length === 0) {
        setQueueData(null);
        setLoadingQueue(false);
        return;
      }

      const myApt = todayApts[0];

      // Get all appointments at the same hospital for today to calculate position
      const { data: allApts, error: allErr } = await supabase
        .from('appointments')
        .select(`
          id, status, created_at,
          hospital_slots(slot_date, start_time)
        `)
        .eq('hospital_id', myApt.hospital_id)
        .in('status', ['confirmed', 'in_progress', 'completed'])
        .order('created_at', { ascending: true });

      if (allErr) throw allErr;

      const todayAll = (allApts || []).filter(a =>
        a.hospital_slots?.slot_date === today
      );

      const completedCount = todayAll.filter(a => a.status === 'completed').length;
      const inProgressCount = todayAll.filter(a => a.status === 'in_progress').length;
      const myIndex = todayAll.findIndex(a => a.id === myApt.id);
      const position = myIndex - completedCount - inProgressCount;
      const totalToday = todayAll.length;
      const estimatedWait = Math.max(0, position) * 15; // 15 min avg per patient

      let queueStatus = 'waiting';
      if (myApt.status === 'in_progress') queueStatus = 'in_consultation';
      else if (myApt.status === 'completed') queueStatus = 'completed';
      else if (position <= 1) queueStatus = 'almost';

      setQueueData({
        appointment_id: myApt.id,
        hospital_id: myApt.hospital_id,
        hospital_name: myApt.hospital?.full_name,
        doctor_name: myApt.doctor?.full_name,
        slot_time: myApt.hospital_slots?.start_time?.substring(0, 5),
        position: Math.max(0, position),
        totalToday,
        completedCount,
        estimatedWait,
        queueStatus,
      });
    } catch (err) {
      console.error('Queue fetch error:', err);
      setQueueData(null);
    } finally {
      setLoadingQueue(false);
    }
  };

  return (
    <div className="flex flex-col items-center fade-in w-full min-h-screen relative bg-gray-50 overflow-x-hidden pb-16">
      
      {/* ═══════════════════════════════════
          ANNOUNCEMENT TICKER (Widget Wrap)
      ═══════════════════════════════════ */}
      <div className="w-full bg-red-600 text-white overflow-hidden shadow-sm relative z-50 flex items-stretch h-10 shrink-0">
        <div className="bg-red-700 px-4 flex items-center justify-center text-xs font-black uppercase shadow-[4px_0_10px_rgba(0,0,0,0.1)] z-10 relative shrink-0 tracking-widest w-24">
          Alerts
        </div>
        <div className="flex-1 overflow-hidden relative flex items-center">
          <div className="animate-marquee hover:animation-play-state-paused flex gap-10 whitespace-nowrap cursor-pointer">
            <div className="flex gap-16 pr-10 items-center">
              <a href="https://nhm.maharashtra.gov.in/en/scheme/maharashtra-emergency-medical-services-mems-emergency-medical-service-on-call/" target="_blank" rel="noreferrer" className="text-[11px] font-bold tracking-widest uppercase hover:underline flex items-center gap-2 text-white">
                🚨 Maharashtra Emergency Service
              </a>
              <a href="https://www.myscheme.gov.in/schemes/ab-pmjay" target="_blank" rel="noreferrer" className="text-[11px] font-bold tracking-widest uppercase hover:underline flex items-center gap-2 text-white">
                🛡️ Government Insurance Services
              </a>
            </div>
            <div className="flex gap-16 pr-10 items-center" aria-hidden="true">
              <a href="https://nhm.maharashtra.gov.in/en/scheme/maharashtra-emergency-medical-services-mems-emergency-medical-service-on-call/" target="_blank" rel="noreferrer" className="text-[11px] font-bold tracking-widest uppercase hover:underline flex items-center gap-2 text-white">
                🚨 Maharashtra Emergency Service
              </a>
              <a href="https://www.myscheme.gov.in/schemes/ab-pmjay" target="_blank" rel="noreferrer" className="text-[11px] font-bold tracking-widest uppercase hover:underline flex items-center gap-2 text-white">
                🛡️ Government Insurance Services
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Container Wrapper */}
      <div className="w-full max-w-7xl mx-auto flex flex-col flex-1 h-full py-6 px-4 md:px-8 gap-8">
      
        {/* CAROUSEL / SLIDER */}
        <div className="w-full relative flex-none h-[240px] sm:h-[300px] md:h-[420px] bg-gray-900 shadow-2xl rounded-3xl overflow-hidden mt-2">
          {/* Slide 1 */}
          <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${currentSlide === 0 ? 'opacity-100 relative z-10' : 'opacity-0 z-0'}`}>
            <img src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80" alt="PM JAY" className="w-full h-full object-cover opacity-40 mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-transparent flex flex-col justify-center px-8 md:px-16">
              <span className="bg-orange-500 text-white text-[11px] md:text-xs font-black tracking-widest uppercase px-2 py-1 rounded w-max mb-2 shadow-md">Ayushman Bharat</span>
              <h2 className="text-white font-black text-3xl md:text-5xl leading-tight mb-2 md:mb-4 tracking-tight">Pradhan Mantri<br/>Jan Arogya Yojana</h2>
              <p className="text-blue-50 text-xs md:text-sm font-medium mb-4 max-w-[70%] md:max-w-[50%] leading-relaxed drop-shadow-md">Avail free healthcare services up to ₹5 Lakhs per family per year at empaneled hospitals.</p>
              <a href="https://www.myscheme.gov.in/schemes/ab-pmjay" target="_blank" rel="noreferrer" className="text-sm md:text-base text-white font-bold underline underline-offset-4 hover:text-orange-300 transition-colors w-max">Verify Eligibility &rarr;</a>
            </div>
          </div>
          
          {/* Slide 2 */}
          <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${currentSlide === 1 ? 'opacity-100 relative z-10' : 'opacity-0 z-0'}`}>
            <img src="https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80" alt="Initiatives" className="w-full h-full object-cover opacity-40 mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/90 to-emerald-800/60 flex flex-col justify-center px-8 md:px-16 text-right items-end">
              <span className="bg-white text-emerald-900 text-[11px] md:text-xs font-black tracking-widest uppercase px-2 py-1 rounded w-max mb-2 shadow-md">Govt of India</span>
              <h2 className="text-white font-black text-3xl md:text-5xl leading-tight mb-2 md:mb-4 tracking-tight">Key Initiatives<br/>in Healthcare</h2>
              <p className="text-emerald-50 text-xs md:text-sm font-medium mb-4 max-w-[70%] md:max-w-[50%] text-right leading-relaxed drop-shadow-md">Exploring national programs focusing on digital health records and universal care systems.</p>
              <a href="https://nhm.gov.in/" target="_blank" rel="noreferrer" className="text-sm md:text-base text-white font-bold underline underline-offset-4 hover:text-emerald-300 transition-colors w-max">Explore Initiatives &rarr;</a>
            </div>
          </div>

          <div className="absolute bottom-3 left-0 w-full flex justify-center gap-2 z-20">
            <div onClick={() => setCurrentSlide(0)} className={`h-1.5 md:h-2 rounded-full transition-all cursor-pointer shadow-sm ${currentSlide === 0 ? 'w-6 md:w-8 bg-white' : 'w-2 md:w-3 bg-white/50 hover:bg-white/80'}`}></div>
            <div onClick={() => setCurrentSlide(1)} className={`h-1.5 md:h-2 rounded-full transition-all cursor-pointer shadow-sm ${currentSlide === 1 ? 'w-6 md:w-8 bg-white' : 'w-2 md:w-3 bg-white/50 hover:bg-white/80'}`}></div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full flex-1 flex flex-col relative max-w-7xl mx-auto pt-4 pb-12 gap-8">
      
      {/* ═══════════════════════════════════
          LIVE QUEUE POSITION TRACKER
      ═══════════════════════════════════ */}
      {!loadingQueue && queueData && (
        <div className="w-full mb-3 md:mb-4 animate-fade-in-up">
          <div className={`relative rounded-3xl p-4 md:p-5 shadow-lg border-2 overflow-hidden transition-all ${
            queueData.queueStatus === 'in_consultation' 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
              : queueData.queueStatus === 'almost'
              ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'
              : queueData.queueStatus === 'completed'
              ? 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
              : 'bg-gradient-to-br from-primary-50 to-blue-50 border-primary-200'
          }`}>
            {/* Live pulse indicator */}
            {queueData.queueStatus !== 'completed' && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Live</span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                queueData.queueStatus === 'in_consultation' ? 'bg-green-100' :
                queueData.queueStatus === 'almost' ? 'bg-amber-100' : 'bg-primary-100'
              }`}>
                <Zap className={`w-4 h-4 ${
                  queueData.queueStatus === 'in_consultation' ? 'text-green-600' :
                  queueData.queueStatus === 'almost' ? 'text-amber-600' : 'text-primary-600'
                }`} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900">Live Queue Tracker</h3>
                <p className="text-[10px] text-gray-500 font-medium">
                  {queueData.hospital_name}
                  {queueData.doctor_name && ` • Dr. ${queueData.doctor_name}`}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-3">
              {queueData.queueStatus === 'in_consultation' && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold animate-pulse">
                  🏥 You’re In Consultation Now
                </span>
              )}
              {queueData.queueStatus === 'almost' && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold animate-pulse">
                  ⚡ Almost Your Turn!
                </span>
              )}
              {queueData.queueStatus === 'waiting' && (
                <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-[10px] font-bold">
                  ⏳ Waiting • Slot at {queueData.slot_time}
                </span>
              )}
              {queueData.queueStatus === 'completed' && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold">
                  ✅ Visit Completed
                </span>
              )}
            </div>

            {/* Queue Stats */}
            {queueData.queueStatus !== 'completed' && (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white">
                    <p className="text-2xl font-black text-gray-900">{queueData.position}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">In Line</p>
                  </div>
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white">
                    <p className="text-2xl font-black text-gray-900">~{queueData.estimatedWait}<span className="text-xs">m</span></p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Est. Wait</p>
                  </div>
                  <div className="bg-white/70 backdrop-blur-sm rounded-xl p-3 text-center border border-white">
                    <p className="text-2xl font-black text-gray-900">{queueData.completedCount}<span className="text-xs text-gray-400">/{queueData.totalToday}</span></p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Done Today</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white/50 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      queueData.queueStatus === 'almost' ? 'bg-amber-400' : 'bg-primary-500'
                    }`}
                    style={{ width: `${Math.min(100, (queueData.completedCount / Math.max(1, queueData.totalToday)) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium mt-1.5 text-center">
                  {queueData.completedCount} of {queueData.totalToday} patients seen today
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex w-full gap-3 md:gap-5 mt-auto flex-wrap sm:flex-nowrap justify-center">
        {profile?.role === 'doctor' ? (
          <>
            <button onClick={() => navigate('/doctor-manage')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <Users className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase text-center leading-tight">Patient<br/>Appointments</span>
            </button>
            <button onClick={() => navigate('/doctor-manage')} className="flex-1 min-w-[140px] md:min-w-[160px] bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-lg hover:-translate-y-1 transition-all active:-translate-y-0.5 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                 <FileText className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-white tracking-wide uppercase text-center leading-tight">Patient<br/>Records</span>
            </button>
            <button onClick={() => navigate('/profile')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <UserCircle className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase">My Profile</span>
            </button>
          </>
        ) : profile?.role === 'hospital' ? (
          <>
            <button onClick={() => navigate('/room-allocation')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <Activity className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase text-center leading-tight">Room<br/>Allocation</span>
            </button>
            <button onClick={() => navigate('/hospital-manage')} className="flex-1 min-w-[140px] md:min-w-[160px] bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-lg hover:-translate-y-1 transition-all active:-translate-y-0.5 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                 <Building2 className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-white tracking-wide uppercase text-center leading-tight">Manage<br/>Hospital</span>
            </button>
            <button onClick={() => navigate('/profile')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <UserCircle className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase">My Profile</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/bookings')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <CalendarIcon className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase">Bookings</span>
            </button>
            <button onClick={() => navigate('/emergency')} className="flex-1 min-w-[140px] md:min-w-[160px] bg-gradient-to-br from-red-600 to-red-800 rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-lg hover:shadow-red-500/30 hover:-translate-y-1 transition-all active:-translate-y-0.5 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                 <PlusSquare className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-white tracking-wide uppercase">Emergency</span>
            </button>
            <button onClick={() => navigate('/records')} className="flex-1 min-w-[120px] md:min-w-[140px] bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 flex flex-col items-center justify-center shadow-md border border-gray-100 hover:border-primary-200 hover:-translate-y-1 transition-all active:scale-95 group">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                 <FileText className="w-5 h-5 md:w-7 md:h-7 text-primary-600" />
              </div>
              <span className="text-xs md:text-sm font-extrabold text-gray-700 tracking-wide uppercase">Records</span>
            </button>
          </>
        )}
      </div>
      
    </div>
    </div>
    </div>
  );
};

export default Home;
