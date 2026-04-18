import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  PhoneCall, Activity, Navigation2, CheckCircle2,
  AlertTriangle, Loader2, Building2, Stethoscope, Clock, ShieldAlert
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';

// ── Icons ──
const ambulanceIcon = new L.DivIcon({
  html: `<div style="font-size: 24px; background: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid #dc2626;">🚑</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: 'custom-amb-icon'
});

const hospitalIcon = new L.DivIcon({
  html: `<div style="font-size: 20px; background: white; border-radius: 12px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid #3b82f6;">🏥</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'custom-hosp-icon'
});

const userIcon = new L.DivIcon({
  html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: '',
});

// Fits bounds to markers
function MapEffect({ location, activeHospitals, ambulances }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (location) points.push([location.lat, location.lng]);
    activeHospitals.forEach(h => {
      if (h.lat && h.lng) points.push([h.lat, h.lng]);
    });
    ambulances.forEach(a => points.push([a.lat, a.lng]));

    if (points.length > 1) {
      map.fitBounds(points, { padding: [50, 50], maxZoom: 14 });
    } else if (points.length === 1) {
      map.flyTo(points[0], 14);
    }
  }, [location, map]);
  return null;
}

// Dedicated Live Tracking Effect that actively follows the ambulance on every DB coordinate tick!
function LiveTrackingEffect({ isTracking, targetCoords }) {
  const map = useMap();
  useEffect(() => {
    if (isTracking && targetCoords?.lat && targetCoords?.lng) {
      map.flyTo([targetCoords.lat, targetCoords.lng], 16, { animate: true, duration: 1.5 });
    }
  }, [isTracking, targetCoords?.lat, targetCoords?.lng, map]);
  return null;
}

// Distance util
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

const EmergencyTracker = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetHospId = searchParams.get('hosp');
  const prefillLat = searchParams.get('lat');
  const prefillLng = searchParams.get('lng');
  
  const [userLocation, setUserLocation] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ambulanceType, setAmbulanceType] = useState('ALS'); // BLS, ALS, NICU
  const [selectedAmbulance, setSelectedAmbulance] = useState(null);
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  const [bookingState, setBookingState] = useState(null); // { type: 'ambulance'|'icu', id: string, status: 'requesting'|'confirmed'|'completed', booking_id?: string }

  // Initial Data Fetch & Location
  useEffect(() => {
    const init = async () => {
      // Force Pune location for demo consistency matching our DB seeds
      // This prevents patients' real locations (e.g., Patna) from pulling 
      // ambulances 1000s of miles away from the seeded hospitals
      let loc = { lat: 18.5204, lng: 73.8567 };

      if (prefillLat && prefillLng) {
        loc = { lat: parseFloat(prefillLat), lng: parseFloat(prefillLng) };
      }
      
      setUserLocation(loc);

      // 2. Fetch Hospitals
      const { data } = await supabase.from('hospital_admins').select('id, full_name, city, state, address, lat, lng, available_icu_beds');
      if (data) {
        // Assign real ICU beds from DB
        const withIcu = data.filter(h => h.lat && h.lng).map(h => ({
          ...h,
          icuBeds: h.available_icu_beds || 0,
          distance: getDistance(loc.lat, loc.lng, h.lat, h.lng)
        })).sort((a, b) => a.distance - b.distance);
        setHospitals(withIcu);
      }

      // 3. Fetch Real Drivers & Dummy Ambulances
      const [realRes, dummyRes] = await Promise.all([
        supabase.from('ambulance_drivers').select('*'),
        supabase.from('ambulances').select('*')
      ]);

      const realDrivers = realRes.data || [];
      const dummyAmbs = dummyRes.data || [];

      let mergedAmbs = [];
      let needsDbSync = false;

      // Handle real drivers
      realDrivers.forEach(a => {
        const aLat = a.lat || loc.lat + ((Math.random() - 0.5) * 0.05);
        const aLng = a.lng || loc.lng + ((Math.random() - 0.5) * 0.05);
        const dist = getDistance(loc.lat, loc.lng, aLat, aLng);
        mergedAmbs.push({ ...a, lat: aLat, lng: aLng, distance: dist, is_dummy: false, title_name: a.full_name });
      });

      // Handle dummy ambulances (teleport near user)
      dummyAmbs.forEach(a => {
        const dist = getDistance(loc.lat, loc.lng, a.lat, a.lng);
        if (!a.lat || dist > 50) {
          needsDbSync = true;
          const offsetLat = (Math.random() - 0.5) * 0.05;
          const offsetLng = (Math.random() - 0.5) * 0.05;
          mergedAmbs.push({ ...a, lat: loc.lat + offsetLat, lng: loc.lng + offsetLng, distance: getDistance(loc.lat, loc.lng, loc.lat + offsetLat, loc.lng + offsetLng), is_dummy: true, title_name: a.driver_name });
        } else {
          mergedAmbs.push({ ...a, distance: dist, is_dummy: true, title_name: a.driver_name });
        }
      });

      if (needsDbSync) {
        mergedAmbs.filter(a => a.is_dummy).forEach(async (a) => {
          await supabase.from('ambulances').update({ lat: a.lat, lng: a.lng }).eq('id', a.id);
        });
      }

      setAmbulances(mergedAmbs);
      setLoading(false);
    };

    init();
  }, []);

  // Listen to realtime GPS updates from both tables
  useEffect(() => {
    const channel1 = supabase.channel('ambulances_tracking_real')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ambulance_drivers' }, 
        (payload) => {
          setAmbulances(prev => prev.map(a => a.id === payload.new.id ? {
            ...a, ...payload.new, distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, payload.new.lat, payload.new.lng) : a.distance
          } : a));
        }
      ).subscribe();

    const channel2 = supabase.channel('ambulances_tracking_dummy')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ambulances' }, 
        (payload) => {
          setAmbulances(prev => prev.map(a => a.id === payload.new.id ? {
            ...a, ...payload.new, distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, payload.new.lat, payload.new.lng) : a.distance
          } : a));
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [userLocation]);

  // Self-Driving Simulation: We only move it if status is 'accepted', 'en_route', or 'arriving' OR it is a dummy ambulance that is 'confirmed'
  useEffect(() => {
    if (!userLocation || !bookingState || bookingState.type !== 'ambulance') return;
    if (bookingState.is_dummy && bookingState.status !== 'confirmed') return;
    if (!bookingState.is_dummy && !['accepted', 'en_route', 'arriving'].includes(bookingState.status)) return;

    const interval = setInterval(async () => {
      const amb = ambulances.find(a => a.id === bookingState.id);
      if (!amb) return;

      const latDiff = userLocation.lat - amb.lat;
      const lngDiff = userLocation.lng - amb.lng;

      if (Math.abs(latDiff) < 0.0005 && Math.abs(lngDiff) < 0.0005) {
         if (bookingState.is_dummy) {
            if (bookingState.booking_id) await supabase.from('ambulance_bookings').update({ status: 'completed' }).eq('id', bookingState.booking_id);
            await supabase.from('ambulances').update({ available: true }).eq('id', amb.id);
            setBookingState(prev => ({ ...prev, status: 'completed' }));
         }
         return;
      }

      // Step towards user (~50 meters)
      const step = 0.0005 * (amb.speed_multiplier || 1.0);
      const newLat = amb.lat + (Math.sign(latDiff) * Math.min(Math.abs(latDiff), step));
      const newLng = amb.lng + (Math.sign(lngDiff) * Math.min(Math.abs(lngDiff), step));

      if (bookingState.is_dummy) {
        await supabase.from('ambulances').update({ lat: newLat, lng: newLng }).eq('id', amb.id);
      } else {
        await supabase.from('ambulance_drivers').update({ lat: newLat, lng: newLng }).eq('id', amb.id);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [userLocation, bookingState, ambulances]);

  // Listen for request status changes from DriverDashboard
  useEffect(() => {
    if (!bookingState?.booking_id) return;

    const channel = supabase.channel('request_status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ambulance_requests', filter: `id=eq.${bookingState.booking_id}` },
        (payload) => {
          setBookingState(prev => ({ ...prev, status: payload.new.status }));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [bookingState?.booking_id]);

  const nearestAmbulance = ambulances
    .filter(a => a.available)
    .sort((a, b) => (getDistance(userLocation?.lat||0, userLocation?.lng||0, a.lat, a.lng) - getDistance(userLocation?.lat||0, userLocation?.lng||0, b.lat, b.lng)))[0];

  const totalIcuBeds = hospitals.reduce((sum, h) => sum + h.icuBeds, 0);

  const targetHospitalInfo = targetHospId ? hospitals.find(h => h.id === targetHospId) : null;

  const handleRequestAmbulance = async (id) => {
    if (!user) {
      setBookingError("Please sign in to confirm an ambulance booking.");
      return;
    }
    setBookingError(null);
    setBookingState({ type: 'ambulance', id, status: 'requesting' });
    
    try {
      const validHospId = (targetHospId && targetHospId !== 'null' && targetHospId !== '') ? targetHospId : null;
      const targetAmb = ambulances.find(a => a.id === id);

      if (targetAmb?.is_dummy) {
        // Dummy logic
        const { data: booking, error } = await supabase.from('ambulance_bookings').insert({
          ambulance_id: id,
          patient_id: user.id || null,
          pickup_lat: userLocation.lat,
          pickup_lng: userLocation.lng,
          dropoff_hospital_id: validHospId,
          status: 'confirmed'
        }).select().single();
        if (error) throw error;
        await supabase.from('ambulances').update({ available: false }).eq('id', id);
        setBookingState({ type: 'ambulance', id, status: 'confirmed', booking_id: booking.id, is_dummy: true });
      } else {
        // Real Driver logic
        const { data: booking, error } = await supabase.from('ambulance_requests').insert({
          driver_id: id,
          patient_id: user.id || null,
          patient_name: profile?.full_name || 'Emergency Patient',
          patient_phone: profile?.phone || '',
          pickup_lat: userLocation.lat,
          pickup_lng: userLocation.lng,
          dropoff_hospital_id: validHospId,
          status: 'requesting'
        }).select().single();
        if (error) throw error;
        setBookingState({ type: 'ambulance', id, status: 'requesting', booking_id: booking.id, is_dummy: false });
      }
    } catch (err) {
      console.error("Booking Error:", err);
      // Remove native alert and clear state properly so UI resyncs
      setBookingState({ type: 'ambulance', id, status: 'error' });
      setBookingError(err.message || "Booking failed. Please try again.");
      
      // Auto clear error state after 3s
      setTimeout(() => {
        setBookingState(null);
        setBookingError(null);
      }, 4000);
    }
  };

  const handleBookICU = (id) => {
    setBookingState({ type: 'icu', id, status: 'requesting' });
    setTimeout(() => {
      setHospitals(prev => prev.map(h => h.id === id ? { ...h, icuBeds: Math.max(0, h.icuBeds - 1) } : h));
      setBookingState({ type: 'icu', id, status: 'confirmed' });
    }, 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <div className="absolute -inset-4 border-2 border-red-500 rounded-full animate-ping opacity-20"></div>
        </div>
        <p className="mt-4 text-sm font-bold text-gray-500 tracking-widest uppercase">Initializing SOS Network...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50 overflow-hidden">
      
      {/* Header - Hides when in active tracking mode */}
      {!isTrackingMode && (
        <div className="bg-red-600 sticky top-0 z-40 px-4 py-4 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">Live Emergency Network</h1>
                <p className="text-red-100 text-[10px] font-bold uppercase tracking-wider">ICU & Ambulance Tracking</p>
              </div>
            </div>
            <button className="bg-white text-red-600 px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:scale-105 transition-transform flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5" /> Call 112
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 w-full relative">
        <MapContainer 
          center={userLocation ? [userLocation.lat, userLocation.lng] : [19.0760, 72.8777]} 
          zoom={13} 
          className={`w-full z-0 transition-all duration-500 ${isTrackingMode ? 'h-[100vh]' : 'h-[55vh]'}`}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {!isTrackingMode && <MapEffect location={userLocation} activeHospitals={hospitals} ambulances={ambulances} />}
          <LiveTrackingEffect isTracking={isTrackingMode} targetCoords={ambulances.find(a => a.id === bookingState?.id)} />

          {/* Draw Polyline if Ambulance is Booked */}
          {bookingState?.type === 'ambulance' && (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState.status)) && (
            <Polyline 
              positions={[
                [ambulances.find(a => a.id === bookingState.id)?.lat, ambulances.find(a => a.id === bookingState.id)?.lng],
                [userLocation.lat, userLocation.lng]
              ].filter(p => p[0] && p[1])} 
              pathOptions={{ color: '#dc2626', weight: 4, dashArray: '8, 8', opacity: 0.8 }} 
            />
          )}

          {/* User Location */}
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
              <Popup className="custom-popup">
                <div className="font-bold text-gray-800 text-sm">You are here</div>
              </Popup>
            </Marker>
          )}

          {/* Hospitals with ICU */}
          {hospitals.map(hospital => (
            <Marker key={hospital.id} position={[hospital.lat, hospital.lng]} icon={hospitalIcon}>
              <Popup>
                <div className="p-1 min-w-[160px]">
                  <h4 className="font-extrabold text-gray-900 text-sm mb-1 leading-tight">{hospital.full_name}</h4>
                  <p className="text-[10px] text-gray-500 mb-3">{hospital.distance.toFixed(1)} km away</p>
                  
                  <div className={`p-2 rounded-lg mb-3 flex items-center justify-between ${hospital.icuBeds > 0 ? 'bg-red-50 border border-red-100' : 'bg-gray-100'}`}>
                    <span className="text-[10px] font-bold text-gray-600 uppercase">Available ICU Beds</span>
                    <span className={`text-lg font-black ${hospital.icuBeds > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {hospital.icuBeds}
                    </span>
                  </div>

                  {hospital.icuBeds > 0 ? (
                    <button 
                      onClick={() => handleBookICU(hospital.id)}
                      disabled={bookingState?.id === hospital.id}
                      className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-all
                        ${bookingState?.id === hospital.id 
                          ? bookingState.status === 'confirmed' ? 'bg-green-500' : 'bg-amber-500'
                          : 'bg-red-600 hover:bg-red-700 active:scale-95'}`}
                    >
                      {bookingState?.id === hospital.id 
                        ? bookingState.status === 'confirmed' ? 'ICU Bed Reserved!' : 'Requesting...'
                        : 'Reserve ICU Bed'}
                    </button>
                  ) : (
                    <button disabled className="w-full py-2 rounded-lg text-xs font-bold text-gray-400 bg-gray-100 cursor-not-allowed">
                      No Beds Available
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Ambulances */}
          {ambulances.map(amb => (
            <Marker 
              key={amb.id} 
              position={[amb.lat, amb.lng]} 
              icon={ambulanceIcon} 
              zIndexOffset={amb.available ? 1000 : 0}
              eventHandlers={{
                click: () => setSelectedAmbulance(amb)
              }}
            >
              <Popup>
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${amb.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{amb.available ? 'Available' : 'Engaged'}</span>
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm mb-1">{amb.title_name}</h4>
                  <p className="text-[10px] text-gray-500 mb-3 block">{amb.phone} • {amb.vehicle_number} • {getDistance(userLocation?.lat||0, userLocation?.lng||0, amb.lat, amb.lng).toFixed(1)} km away</p>
                  
                  {(amb.available || bookingState?.id === amb.id) && (
                    <button 
                      onClick={() => handleRequestAmbulance(amb.id)}
                      disabled={bookingState?.id === amb.id}
                      className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-all
                        ${bookingState?.id === amb.id 
                          ? (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState.status)) ? 'bg-green-500' 
                          : bookingState.status === 'completed' ? 'bg-gray-400'
                          : bookingState.status === 'error' ? 'bg-red-500'
                          : 'bg-amber-500'
                          : 'bg-primary-600 hover:bg-primary-700 active:scale-95'}`}
                    >
                      {bookingState?.id === amb.id 
                        ? (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState.status)) ? 'En Route!' 
                        : bookingState.status === 'completed' ? 'Arrived!'
                        : bookingState.status === 'error' ? 'Booking Failed'
                        : 'Waiting for Driver...'
                        : 'Dispatch to My Location'}
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Dashboard Bottom Sheets */}
        <div className="absolute bottom-0 left-0 right-0 z-[1000] p-4 space-y-3 pointer-events-none">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-3 pointer-events-auto">
            
            {/* Selected Ambulance Panel */}
            {selectedAmbulance ? (
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 flex-1 w-full animate-fade-in-up">
                <div className={`flex items-start justify-between mb-4 border-b pb-4 ${bookingState?.id === selectedAmbulance.id && bookingState?.status !== 'requesting' ? 'border-green-100 bg-green-50/50 -mx-6 -mt-6 p-6 pb-4 rounded-t-3xl' : 'border-gray-50'}`}>
                  <div>
                     {bookingState?.id === selectedAmbulance.id && bookingState?.status !== 'requesting' ? (
                       <div className="flex items-center gap-2 mb-3 bg-green-100 text-green-700 px-3 py-1.5 rounded-full border border-green-200 w-max shadow-sm">
                           <CheckCircle2 className="w-4 h-4" />
                           <span className="text-[10px] font-extrabold uppercase tracking-widest">{bookingState.status.replace('_', ' ')}</span>
                       </div>
                     ) : (
                       <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none mb-1">Ambulance Details</p>
                     )}
                     <h3 className="font-extrabold text-gray-900 text-lg leading-tight">{selectedAmbulance.title_name}</h3>
                     <p className="text-xs text-gray-500">{selectedAmbulance.phone} • {selectedAmbulance.vehicle_number}</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                     {bookingState?.id === selectedAmbulance.id && (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState?.status)) ? (
                        <>
                           <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center border-2 border-green-500 mb-2 shadow-sm animate-pulse relative">
                              <span className="text-xl">🚑</span>
                           </div>
                           <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest leading-none mb-1">Status</p>
                        </>
                     ) : (
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Live ETA</p>
                     )}
                     <p className="font-black text-primary-600 text-lg leading-tight">{Math.ceil(selectedAmbulance.distance * 3)} mins</p>
                     <p className="text-xs font-bold text-gray-500">{selectedAmbulance.distance.toFixed(1)} km</p>
                  </div>
                </div>

                  {!isTrackingMode && (
                    <div className="space-y-4 mb-6">
                       <div className="flex items-start gap-3">
                         <div className="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                           <Navigation2 className="w-4 h-4 text-blue-500" />
                         </div>
                         <div>
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Pickup Location</p>
                           <p className="text-sm font-bold text-gray-800">Your Current Location</p>
                         </div>
                       </div>
                       
                       {targetHospitalInfo && (
                         <>
                           <div className="relative pl-4 h-4 my-1">
                              <div className="absolute top-0 bottom-0 left-4 w-px bg-gray-200"></div>
                           </div>
                           <div className="flex items-start gap-3">
                             <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                               <Building2 className="w-4 h-4 text-red-500" />
                             </div>
                             <div>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Drop Hospital</p>
                               <p className="text-sm font-bold text-gray-800">{targetHospitalInfo.full_name}</p>
                             </div>
                           </div>
                         </>
                       )}
                    </div>
                  )}

                  {!isTrackingMode && (
                    <div className="mb-6">
                      <span className="px-3 py-1 bg-red-50 text-red-700 font-bold text-xs rounded-full border border-red-100 uppercase tracking-wider items-center gap-1 inline-flex">
                         <Activity className="w-3 h-3" /> {selectedAmbulance.type} Support
                      </span>
                    </div>
                  )}

                {bookingState?.id === selectedAmbulance.id && (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState?.status)) ? (
                  <div className="w-full flex flex-col gap-2">
                    <div className="w-full flex gap-3">
                      <button 
                        onClick={() => setIsTrackingMode(!isTrackingMode)}
                        className={`flex-1 py-4 rounded-xl font-bold border shadow-sm flex items-center justify-center gap-2 transition-colors
                          ${isTrackingMode ? 'bg-gray-800 text-white border-gray-900 shadow-gray-900/40 hover:bg-gray-700' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                      >
                        <Navigation2 className="w-5 h-5" /> {isTrackingMode ? "Exit Fullscreen" : "Track Ambulance"}
                      </button>
                      <button className="flex-1 py-4 bg-green-50 text-green-700 rounded-xl font-bold border border-green-200 shadow-sm flex items-center justify-center gap-2 hover:bg-green-100 transition-colors">
                        <PhoneCall className="w-5 h-5 fill-current" /> Call Driver
                      </button>
                    </div>
                  </div>
                ) : selectedAmbulance.available || bookingState?.id === selectedAmbulance.id ? (
                  <div className="w-full">
                    {bookingError && <p className="text-xs text-red-600 font-bold mb-2 text-center">{bookingError}</p>}
                    <button 
                      onClick={() => handleRequestAmbulance(selectedAmbulance.id)}
                      disabled={bookingState?.id === selectedAmbulance.id || bookingState?.status === 'completed'}
                      className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm
                        ${bookingState?.id === selectedAmbulance.id && bookingState?.status === 'completed'
                          ? 'bg-gray-100 text-gray-500' 
                          : bookingState?.status === 'error'
                          ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 hover:shadow-md shadow-red-500/20 active:scale-95'}`}
                    >
                      {bookingState?.id === selectedAmbulance.id && bookingState?.status === 'completed' 
                        ? <><CheckCircle2 className="w-5 h-5"/> Arrived & Completed</> 
                        : bookingState?.status === 'requesting' 
                        ? <><Loader2 className="w-5 h-5 animate-spin" /> Waiting for Driver...</> 
                        : bookingState?.status === 'error'
                        ? 'Failed'
                        : 'Confirm Dispatch'}
                    </button>
                  </div>
                ) : (
                  <button disabled className="w-full py-4 rounded-xl text-sm font-bold bg-gray-100 text-gray-400">
                    Currently Engaged
                  </button>
                )}

                {!bookingState?.id && (
                  <button onClick={() => setSelectedAmbulance(null)} className="w-full mt-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors">
                    Close Panel
                  </button>
                )}
              </div>
            ) : targetHospitalInfo ? (
              // If aiming for a hospital but no ambulance selected
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 flex-1 w-full animate-fade-in-up">
                <div className="flex flex-col items-center justify-center text-center py-4">
                   <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                      <Navigation2 className="w-8 h-8 text-red-500" />
                   </div>
                   <h3 className="font-extrabold text-gray-900 text-lg mb-2">Hospital Selected</h3>
                   <p className="text-sm text-gray-500 font-medium mb-6">Target: {targetHospitalInfo.full_name}</p>
                   <p className="text-xs font-bold text-primary-600 bg-primary-50 px-4 py-2 rounded-lg border border-primary-100">
                     Tap any 🚑 Ambulance on the map above to view details and Dispatch!
                   </p>
                </div>
              </div>
            ) : (
              <>
                {/* Nearest Ambulance Card (Default) */}
                {nearestAmbulance && (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex-1 animate-fade-in-up">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100 text-2xl shadow-sm">
                          🚑
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-primary-600 uppercase tracking-widest mb-0.5">Nearest Ambulance</p>
                          <h3 className="font-black text-gray-900 text-lg leading-none">{nearestAmbulance.distance.toFixed(1)} km</h3>
                          <p className="text-xs text-gray-500 mt-1 font-medium">Est. arrival: {Math.ceil(nearestAmbulance.distance * 3)} mins</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRequestAmbulance(nearestAmbulance.id)}
                        disabled={bookingState?.id === nearestAmbulance.id}
                        className={`shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm
                          ${bookingState?.id === nearestAmbulance.id 
                            ? (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState.status)) ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-500 text-white'
                            : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'}`}
                      >
                        {bookingState?.id === nearestAmbulance.id 
                          ? (bookingState.status === 'confirmed' || ['accepted', 'en_route', 'arriving'].includes(bookingState.status)) ? 'Dispatched' : <Loader2 className="w-4 h-4 animate-spin" />
                          : 'Dispatch'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ICU Beds Stats (Default) */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex-1 animate-fade-in-up md:delay-75">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                        <Building2 className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-0.5">Total ICU Beds Available</p>
                        <div className="flex items-end gap-2">
                          <h3 className="font-black text-gray-900 text-2xl leading-none">{totalIcuBeds}</h3>
                          <span className="text-xs font-bold py-0.5 px-2 bg-gray-100 text-gray-500 rounded-md mb-0.5">In {hospitals.length} hospitals</span>
                        </div>
                      </div>
                   </div>
                   <p className="text-xs text-gray-400 mt-2 font-medium">Tap any <Stethoscope className="w-3 h-3 inline mx-0.5 text-gray-400" /> hospital icon on the map to secure a bed.</p>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmergencyTracker;
