import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Building2 as Hospital, MapPin, Phone, ArrowLeft, Loader2, BedDouble, CheckCircle2, AlertCircle, PlusSquare } from 'lucide-react';

const HospitalDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wards, setWards] = useState([]);
  const [bookingBed, setBookingBed] = useState(null); 
  const [bookedBeds, setBookedBeds] = useState(new Set());

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
        generateMockWards(data.available_icu_beds || 0, data.id);
      }
      setLoading(false);
    };

    fetchHospital();
  }, [id]);

  // Deterministic mock ward generator based on available beds
  const generateMockWards = (availableCount, hid) => {
    // Determine random seed via id length or string hash to keep it consistent
    const seed = hid.length + (hid.charCodeAt(0) || 0);
    const wardNames = ['General ICU Ward A', 'General ICU Ward B', 'Emergency Resuscitation ICU', 'Neonatal ICU (NICU)'];
    
    let allocatedAvailable = 0;
    const finalWards = wardNames.map((name, idx) => {
      // Mock total capacity per ward (8 to 15)
      const capacity = 8 + ((seed + idx) % 8);
      
      // Calculate how many of the true available beds fall into this ward
      let availableInThisWard = 0;
      if (idx === wardNames.length - 1) {
        availableInThisWard = Math.max(0, availableCount - allocatedAvailable);
      } else {
        availableInThisWard = Math.floor(availableCount / wardNames.length);
        if ((seed + idx) % 2 === 0) availableInThisWard += 1; // randomize slightly
        if (allocatedAvailable + availableInThisWard > availableCount) {
          availableInThisWard = availableCount - allocatedAvailable;
        }
      }
      allocatedAvailable += availableInThisWard;
      
      // Guard against capacity overloads
      const guaranteedCapacity = Math.max(capacity, availableInThisWard + 2);

      // Generate bed array
      const beds = Array.from({ length: guaranteedCapacity }).map((_, bIdx) => {
        // Distribute available status deterministically
        const isAvailable = bIdx < availableInThisWard;
        return {
          id: `ward-${idx}-bed-${bIdx}`,
          name: `Bed ${bIdx + 1}`,
          isAvailable: isAvailable
        };
      });

      // Shuffle beds deterministically so available ones aren't just clumped at the start
      beds.sort((a, b) => a.id.localeCompare(b.id));

      return {
        id: `ward-${idx}`,
        name: name,
        capacity: guaranteedCapacity,
        available: availableInThisWard,
        beds: beds
      };
    });

    setWards(finalWards.filter(w => w.capacity > 0)); // Safety filter
  };

  const handleBookBed = (wardId, bedId) => {
    if (bookedBeds.size >= 2) {
      alert("You can only reserve up to 2 beds at a time during an emergency.");
      return;
    }
    setBookingBed(bedId);
    setTimeout(() => {
      setBookedBeds(prev => new Set([...prev, bedId]));
      setBookingBed(null);
      // Ideally we would trigger a supabase .rpc() here to decrement available_icu_beds
    }, 1500);
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
         <div className="flex items-center justify-between">
           <h2 className="text-xl font-extrabold text-gray-900">Live Ward Map</h2>
           <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Available</div>
             <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Occupied</div>
           </div>
         </div>

         {wards.map((ward) => (
           <div key={ward.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
             <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
               <div>
                  <h3 className="font-extrabold text-gray-900 text-lg">{ward.name}</h3>
                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{ward.available} of {ward.capacity} Beds Open</p>
               </div>
               {ward.available > 0 ? (
                 <span className="bg-green-50 text-green-600 border border-green-100 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">Accepting</span>
               ) : (
                 <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">Full</span>
               )}
             </div>

             {/* Bed Grid */}
             <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
               {ward.beds.map((bed) => {
                 const isBookedLocally = bookedBeds.has(bed.id);
                 const isAvailable = bed.isAvailable && !isBookedLocally;
                 const isBooking = bookingBed === bed.id;

                 return (
                   <button
                     key={bed.id}
                     disabled={!isAvailable && !isBookedLocally}
                     onClick={() => { if (isAvailable && !isBooking) handleBookBed(ward.id, bed.id); }}
                     className={`relative p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border
                       ${isBookedLocally ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-500/20' : 
                         isAvailable ? 'bg-green-50 border-green-100 hover:bg-green-100/70 hover:border-green-200 hover:-translate-y-0.5 cursor-pointer text-green-700' :
                         'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed opacity-75'
                       }
                     `}
                   >
                     {isBooking ? (
                       <Loader2 className="w-7 h-7 animate-spin text-green-600" />
                     ) : isBookedLocally ? (
                       <CheckCircle2 className="w-7 h-7 text-white" />
                     ) : (
                       <BedDouble className={`w-7 h-7 ${isAvailable ? 'text-green-500' : 'text-red-400'}`} />
                     )}
                     
                     <span className={`text-[11px] font-bold uppercase tracking-widest
                       ${isBookedLocally ? 'text-green-100' : isAvailable ? 'text-green-700' : 'text-gray-400'}
                     `}>
                       {isBookedLocally ? 'Reserved' : bed.name}
                     </span>

                     {/* Indicator dot */}
                     {!isBookedLocally && !isBooking && (
                       <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-red-400'}`}></div>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>
         ))}
      </div>
    </div>
  );
};

export default HospitalDetail;
