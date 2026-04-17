import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Calendar as CalendarIcon, FileText, Volume2, Loader2, X, Send, Clock, Users, Stethoscope, Building2, Zap, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendToGemini, startSpeechRecognition, speakText } from '../services/geminiVoice';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { format } from 'date-fns';

const Home = () => {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const chatEndRef = useRef(null);

  const { user } = useAuth();
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // Live Queue Tracker
  const [queueData, setQueueData] = useState(null);
  const [loadingQueue, setLoadingQueue] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUpcomingAppointments();
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

  const fetchUpcomingAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, status, token_number, created_at,
          hospital:hospital_admins(full_name),
          doctor:doctors(full_name),
          hospital_slots(slot_date, start_time)
        `)
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!error && data) {
        setUpcomingAppointments(data);
      }
    } catch (err) {
      console.error('Error fetching upcoming appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleVoiceClick = async () => {
    if (isListening || isProcessing) return;

    setShowChat(true);
    setIsListening(true);

    try {
      const transcript = await startSpeechRecognition();
      setIsListening(false);
      
      if (transcript) {
        await processMessage(transcript);
      }
    } catch (err) {
      setIsListening(false);
      // If speech recognition fails, just open chat so user can type
      console.warn('Speech recognition unavailable:', err.message);
    }
  };

  const processMessage = async (userText) => {
    const newMessages = [...messages, { role: 'user', text: userText }];
    setMessages(newMessages);
    scrollToBottom();
    setIsProcessing(true);

    try {
      // Build conversation history for context
      const history = newMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const aiResponse = await sendToGemini(userText, history.slice(0, -1));
      
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
      scrollToBottom();

      // Speak the response
      setIsSpeaking(true);
      await speakText(aiResponse);
      setIsSpeaking(false);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process that. Please try again.' }]);
      scrollToBottom();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSend = () => {
    if (!textInput.trim() || isProcessing) return;
    const msg = textInput.trim();
    setTextInput('');
    processMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  return (
    <div className="flex flex-col items-center px-6 pt-6 pb-20 fade-in w-full h-full justify-between relative">
      
      {/* Top Graphic */}
      <div className="w-full relative rounded-3xl overflow-hidden shadow-lg h-[200px] mb-6 ring-4 ring-primary-50">
        <img 
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=1000&auto=format&fit=crop" 
          alt="Healthcare professional" 
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-900/40 to-transparent"></div>
        <div className="absolute bottom-4 left-5 text-white">
          <p className="text-sm font-medium opacity-80">Your AI Health Companion</p>
          <h2 className="text-xl font-extrabold tracking-tight">Careplus</h2>
        </div>
      </div>

      {/* Voice Assistant Button */}
      <div className="flex flex-col items-center justify-center flex-1 w-full space-y-5 mt-4">
        <div className="relative group cursor-pointer" onClick={handleVoiceClick}>
          {/* Pulse rings */}
          {isListening && (
            <>
              <div className="absolute inset-0 bg-primary-400 rounded-full animate-ping opacity-20 scale-150"></div>
              <div className="absolute inset-0 bg-primary-300 rounded-full animate-ping opacity-10 scale-[2] animation-delay-200"></div>
            </>
          )}
          <div className="absolute inset-0 bg-primary-400 rounded-full blur-3xl opacity-15 scale-150"></div>
          <div className={`w-28 h-28 rounded-full flex items-center justify-center shadow-2xl relative z-10 transition-all duration-300 active:scale-95 border-4 border-white
            ${isListening ? 'bg-red-500 scale-110' : isProcessing ? 'bg-amber-500' : 'bg-primary-700 hover:scale-105'}`}>
            {isProcessing ? (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            ) : isListening ? (
              <MicOff className="w-10 h-10 text-white" />
            ) : (
              <Mic className="w-10 h-10 text-white" />
            )}
          </div>
        </div>
        
        <div className="text-center space-y-1 relative z-10">
          <h2 className="text-2xl font-extrabold text-primary-900 tracking-tight">
            {isListening ? 'Listening...' : isProcessing ? 'Thinking...' : 'Tap to Speak'}
          </h2>
          <p className="text-sm text-primary-700/70 font-medium tracking-wide">
            {isListening ? 'Speak your question now' : 'Ask me about health, bookings, or symptoms'}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════
          LIVE QUEUE POSITION TRACKER
      ═══════════════════════════════════ */}
      {!loadingQueue && queueData && (
        <div className="w-full mt-6 animate-fade-in-up">
          <div className={`relative rounded-2xl p-5 shadow-lg border overflow-hidden transition-all ${
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

      {/* Upcoming Bookings Section */}
      <div className="w-full mt-8 animate-fade-in-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-lg">
            Recent Appointments
          </h3>
          <button onClick={() => navigate('/records')} className="text-xs font-bold text-primary-600 hover:text-primary-700">
            View All
          </button>
        </div>

        {loadingAppointments ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
          </div>
        ) : upcomingAppointments.length === 0 ? (
          <div className="bg-gray-100/50 rounded-2xl p-5 border border-dashed border-gray-200 text-center">
            <p className="text-sm font-medium text-gray-500">No recent appointments found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingAppointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${apt.status === 'confirmed' ? 'bg-primary-500' : apt.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                
                <div className="flex-1 min-w-0 ml-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">Token: {apt.token_number || 'N/A'}</p>
                    <p className={`text-[10px] font-bold capitalize ${apt.status === 'confirmed' ? 'text-primary-600' : apt.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`}>{apt.status}</p>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm truncate">{apt.hospital?.full_name || 'Hospital'}</h4>
                  {apt.doctor && <p className="text-xs font-medium text-gray-500 truncate mt-0.5">Dr. {apt.doctor?.full_name}</p>}
                </div>

                <div className="shrink-0 text-right bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-900">
                    {apt.hospital_slots?.slot_date ? format(new Date(apt.hospital_slots.slot_date + 'T00:00:00'), 'MMM d') : format(new Date(apt.created_at), 'MMM d')}
                  </p>
                  <p className="text-[10px] font-bold text-primary-600 mt-0.5">
                    {apt.hospital_slots?.start_time ? apt.hospital_slots.start_time.substring(0, 5) : format(new Date(apt.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex w-full gap-3 mt-auto pt-8">
        <button onClick={() => navigate('/bookings')} className="flex-[2] bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-gray-100 hover:border-primary-200 transition-all active:scale-95">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mb-1.5">
             <CalendarIcon className="w-4 h-4 text-primary-600" />
          </div>
          <span className="text-[11px] font-bold text-gray-700">Bookings</span>
        </button>
        <button onClick={() => navigate('/symptom-checker')} className="flex-[3] bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md hover:shadow-lg transition-all active:-translate-y-0.5">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1.5 backdrop-blur-sm">
             <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-[11px] font-bold text-white">AI Predict</span>
        </button>
        <button onClick={() => navigate('/records')} className="flex-[2] bg-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm border border-gray-100 hover:border-primary-200 transition-all active:scale-95">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center mb-1.5">
             <FileText className="w-4 h-4 text-primary-600" />
          </div>
          <span className="text-[11px] font-bold text-gray-700">Records</span>
        </button>
      </div>

      {/* Chat Overlay */}
      {showChat && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[75vh] animate-slide-up">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                  <Volume2 className="w-4 h-4 text-primary-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Careplus Assistant</h3>
                  <p className="text-xs text-primary-600 font-medium">
                    {isProcessing ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Online'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowChat(false); window.speechSynthesis?.cancel(); }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Mic className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium">Say something or type below</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed
                    ${msg.role === 'user' 
                      ? 'bg-primary-700 text-white rounded-br-md' 
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
              <button 
                onClick={handleVoiceClick}
                disabled={isListening || isProcessing}
                className={`p-3 rounded-full transition-all shrink-0 ${isListening ? 'bg-red-500 text-white' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'}`}
              >
                <Mic className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-gray-100 rounded-full px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-primary-200 transition-all"
              />
              <button 
                onClick={handleTextSend}
                disabled={!textInput.trim() || isProcessing}
                className="p-3 bg-primary-700 text-white rounded-full shrink-0 hover:bg-primary-800 transition-all disabled:opacity-40"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
