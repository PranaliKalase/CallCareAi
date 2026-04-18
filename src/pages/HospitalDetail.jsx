import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2 as Hospital, MapPin, Phone, ArrowLeft, Loader2, BedDouble, CheckCircle2, AlertCircle, PlusSquare, ChevronDown } from 'lucide-react';

const SECTIONS = ['ICU', 'General Ward', 'Emergency'];

const HospitalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(SECTIONS[0]);
  const [bedsData, setBedsData] = useState({
    'ICU': [], 'General Ward': [], 'Emergency': []
  });
  const [bookingBed, setBookingBed] = useState(null); 
  const [bookedBeds, setBookedBeds] = useState(new Set());

  const parseLayout = (data) => {
    let layout = data?.rooms_layout || {};
    const enforce20 = (beds, prefix) => {
      let aligned = Array.isArray(beds) ? beds : [];
      if (aligned.length > 20) return aligned.slice(0, 20);
      if (aligned.length < 20) {
        const extra = Array.from({ length: 20 - aligned.length }).map((_, i) => ({
          id: `${prefix}-bed-${aligned.length + i}`, name: `BED ${aligned.length + i + 1}`, isAvailable: false 
        }));
        return [...aligned, ...extra];
      }
      return aligned;
    };
    return {
      'ICU': enforce20(layout['ICU'], 'icu'),
      'General Ward': enforce20(layout['General Ward'], 'gen'),
      'Emergency': enforce20(layout['Emergency'], 'er')
    };
  };

  useEffect(() => {
    const fetchHospital = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('hospital_admins')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data && !error) {
        setHospital(data);
        setBedsData(parseLayout(data));
      }
      setLoading(false);
    };

    fetchHospital();

    const channel = supabase.channel(`patient_view_${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'hospital_admins', filter: `id=eq.${id}`
      }, (payload) => {
        if (payload.new) {
          setHospital(payload.new);
          setBedsData(parseLayout(payload.new));
        }
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  const handleBookBed = async (bedId) => {
    if (bookedBeds.size >= 2) {
      alert("You can only reserve up to 2 beds at a time during an emergency.");
      return;
    }
    setBookingBed(bedId);

    // Push reservation upstream to lock the bed for the hospital
    if (hospital) {
      const newLayout = { ...bedsData };
      newLayout[activeTab] = newLayout[activeTab].map(b => b.id === bedId ? { ...b, isAvailable: false } : b);
      const openIcu = newLayout['ICU'].filter(b => b.isAvailable).length;

      await supabase.from('hospital_admins')
        .update({ rooms_layout: newLayout, available_icu_beds: openIcu })
        .eq('id', id);
    }
    
    setTimeout(() => {
      setBookedBeds(prev => new Set([...prev, bedId]));
      setBookingBed(null);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
        <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">Loading Facility Map...</p>
      </div>
    );
  }

  if (!hospital) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-gray-700 font-bold mb-4">Hospital not found</p>
        <button onClick={() => navigate('/icu-beds')} className="text-red-500 font-bold">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Info */}
      <div className="bg-white border-b border-gray-100 overflow-hidden relative shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
        <div className="max-w-4xl mx-auto px-5 pt-8 pb-6">
          <button onClick={() => navigate('/icu-beds')} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </button>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight mb-2">{hospital.full_name}</h1>
              <p className="text-sm font-semibold text-gray-500 flex items-center gap-1.5 mb-1">
                 <MapPin className="w-4 h-4 text-red-400" /> {hospital.address}, {hospital.city}, {hospital.state}
              </p>
              {hospital.phone && (
                <p className="text-sm font-semibold text-gray-500 flex items-center gap-1.5">
                   <Phone className="w-4 h-4 text-red-400" /> {hospital.phone}
                </p>
              )}
              
              <div className="flex gap-2 mt-5">
                <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-xl flex items-center gap-2">
                   <span className="text-2xl font-black text-green-600 leading-none">{hospital.available_icu_beds}</span>
                   <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest leading-none">Total<br/>Beds</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => navigate(`/emergency?hosp=${hospital.id}`)}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-95 text-white shadow-md shadow-red-500/20 px-6 py-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1"
            >
              <PlusSquare className="w-6 h-6 mb-1" />
              <span className="text-sm font-bold whitespace-nowrap">Dispatch</span>
              <span className="text-[10px] font-bold text-red-200 uppercase tracking-widest leading-none">Ambulance</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ward Layout */}
      <div className="max-w-4xl mx-auto px-5 py-8 space-y-8">
         
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
           <h2 className="text-xl font-extrabold text-gray-900">Hospital Layout</h2>
           <div className="relative">
             <select 
               value={activeTab} 
               onChange={(e) => setActiveTab(e.target.value)}
               className="appearance-none bg-white border border-gray-200 text-gray-700 font-bold py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm w-full sm:w-auto"
             >
               {SECTIONS.map(section => (
                 <option key={section} value={section}>{section}</option>
               ))}
             </select>
             <ChevronDown className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
           </div>
         </div>

         {/* Exact Grid Styling */}
         <div className="bg-white rounded-3xl border border-gray-50 p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
           <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
             <div>
                <h3 className="font-extrabold text-gray-900 text-xl">{activeTab} Array</h3>
                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                  {bedsData[activeTab]?.filter(b => b.isAvailable).length || 0} OF {bedsData[activeTab]?.length || 0} BEDS OPEN
                </p>
             </div>
             <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
               <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Available</div>
               <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Occupied</div>
             </div>
           </div>

           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
             {bedsData[activeTab]?.map((bed) => {
               const isBookedLocally = bookedBeds.has(bed.id);
               // Patient's locally reserved mask overlays database mapping
               const isAvailable = bed.isAvailable && !isBookedLocally;
               const isBooking = bookingBed === bed.id;

               return (
                 <button
                   key={bed.id}
                   disabled={!isAvailable && !isBookedLocally}
                   onClick={() => { if (isAvailable && !isBooking) handleBookBed(bed.id); }}
                   className={`relative p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border outline-none
                     ${isBooking ? 'bg-green-50 border-green-200 text-green-700 opacity-80' : 
                       isBookedLocally ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm shadow-indigo-500/10' :
                       isAvailable ? 'bg-green-50 border-green-200 hover:bg-green-100 active:scale-95 cursor-pointer text-green-700' :
                       'bg-red-50 border-red-200 text-red-600 shadow-sm shadow-red-500/10 cursor-not-allowed'
                     }
                   `}
                 >
                   {isBooking ? (
                     <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
                   ) : isBookedLocally ? (
                     <CheckCircle2 className="w-7 h-7 text-indigo-500" />
                   ) : (
                     <BedDouble className={`w-7 h-7 ${isAvailable ? 'text-green-500' : 'text-red-400'}`} />
                   )}
                   
                   <span className={`text-[11px] font-bold uppercase tracking-widest ${
                     isBookedLocally ? 'text-indigo-700' : isAvailable ? 'text-green-700' : 'text-red-700'
                   }`}>
                     {isBookedLocally ? 'Reserved' : bed.name}
                   </span>

                   {!isBookedLocally && !isBooking && (
                     <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-400'}`}></div>
                   )}
                 </button>
               );
             })}
           </div>
         </div>
      </div>
    </div>
  );
};

export default HospitalDetail;
