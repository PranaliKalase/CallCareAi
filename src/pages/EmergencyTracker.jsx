import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
const ambulanceIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1032/1032986.png', // Ambulance FlatIcon
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063176.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
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
  const { user } = useAuth();
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

  const [bookingState, setBookingState] = useState(null); // { type: 'ambulance' | 'icu', id: string, status: 'requesting' | 'confirmed' }

  // Initial Data Fetch & Location
  useEffect(() => {
    const init = async () => {
      // 1. Get user location (simulate if fails, or use url params)
      let loc = { lat: 19.0760, lng: 72.8777 }; // Default Mumbai
      if (prefillLat && prefillLng) {
        loc = { lat: parseFloat(prefillLat), lng: parseFloat(prefillLng) };
      } else {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.log("Using default location");
        }
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

      // 3. Generate Mock Ambulances near user
      const mockAmbulances = Array.from({ length: 4 }).map((_, i) => {
        // Random offset within ~5km
        const offsetLat = (Math.random() - 0.5) * 0.05;
        const offsetLng = (Math.random() - 0.5) * 0.05;
        const alat = loc.lat + offsetLat;
        const alng = loc.lng + offsetLng;
        return {
          id: `amb-${i}`,
          driver: `Driver ${String.fromCharCode(65+i)}`,
          phone: `+91 98${Math.floor(Math.random()*10000000)}`,
          lat: alat,
          lng: alng,
          distance: getDistance(loc.lat, loc.lng, alat, alng),
          available: Math.random() > 0.2, // 80% chance available
          speedMultiplier: 0.5 + Math.random() // for simulation
        };
      });
      setAmbulances(mockAmbulances);
      setLoading(false);
    };

    init();
  }, []);

  // Simulate ambulance movement
  useEffect(() => {
    if (!userLocation || ambulances.length === 0) return;
    
    const interval = setInterval(() => {
      setAmbulances(prev => prev.map(amb => {
        if (!amb.available) return amb; // busy ones don't move randomly towards user
        
        // Move slightly towards user or randomly
        const latDiff = userLocation.lat - amb.lat;
        const lngDiff = userLocation.lng - amb.lng;
        
        // Move ~0.0001 deg per interval
        const step = 0.0002 * amb.speedMultiplier;
        
        return {
          ...amb,
          lat: amb.lat + (Math.sign(latDiff) * (Math.random() * step)),
          lng: amb.lng + (Math.sign(lngDiff) * (Math.random() * step)),
          distance: getDistance(userLocation.lat, userLocation.lng, amb.lat, amb.lng)
        };
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, [userLocation, ambulances.length]);

  const nearestAmbulance = ambulances
    .filter(a => a.available)
    .sort((a, b) => (getDistance(userLocation?.lat||0, userLocation?.lng||0, a.lat, a.lng) - getDistance(userLocation?.lat||0, userLocation?.lng||0, b.lat, b.lng)))[0];

  const totalIcuBeds = hospitals.reduce((sum, h) => sum + h.icuBeds, 0);

  const targetHospitalInfo = targetHospId ? hospitals.find(h => h.id === targetHospId) : null;

  const handleRequestAmbulance = (id) => {
    setBookingState({ type: 'ambulance', id, status: 'requesting' });
    setTimeout(() => {
      setAmbulances(prev => prev.map(a => a.id === id ? { ...a, available: false } : a));
      setBookingState({ type: 'ambulance', id, status: 'confirmed' });
    }, 2000);
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
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50">
      
      {/* Header */}
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

      <div className="flex-1 w-full relative">
        <MapContainer 
          center={userLocation ? [userLocation.lat, userLocation.lng] : [19.0760, 72.8777]} 
          zoom={13} 
          className="w-full h-[55vh] z-0"
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <MapEffect location={userLocation} activeHospitals={hospitals} ambulances={ambulances} />

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
            <Marker key={amb.id} position={[amb.lat, amb.lng]} icon={ambulanceIcon} zIndexOffset={amb.available ? 1000 : 0}>
              <Popup>
                <div className="p-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${amb.available ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="font-bold text-xs uppercase tracking-wider text-gray-500">{amb.available ? 'Available' : 'Engaged'}</span>
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm mb-1">{amb.driver}</h4>
                  <p className="text-[10px] text-gray-500 mb-3 block">{amb.phone} • {getDistance(userLocation?.lat||0, userLocation?.lng||0, amb.lat, amb.lng).toFixed(1)} km away</p>
                  
                  {amb.available && (
                    <button 
                      onClick={() => handleRequestAmbulance(amb.id)}
                      disabled={bookingState?.id === amb.id}
                      className={`w-full py-2 rounded-lg text-xs font-bold text-white transition-all
                        ${bookingState?.id === amb.id 
                          ? bookingState.status === 'confirmed' ? 'bg-green-500' : 'bg-amber-500'
                          : 'bg-primary-600 hover:bg-primary-700 active:scale-95'}`}
                    >
                      {bookingState?.id === amb.id 
                        ? bookingState.status === 'confirmed' ? 'Dispatched!' : 'Dispatching...'
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
            
            {/* Dedicated Ambulance Booking Panel when target Hosp is set */}
            {targetHospitalInfo ? (
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 flex-1 w-full animate-fade-in-up">
                <div className="flex items-center justify-between mb-4 border-b border-gray-50 pb-4">
                  <div>
                     <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none mb-1">Direct Booking</p>
                     <h3 className="font-extrabold text-gray-900 text-lg leading-tight">Ambulance Request</h3>
                  </div>
                  {nearestAmbulance && (
                    <div className="text-right">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Nearest ETA</p>
                       <p className="font-black text-primary-600 text-lg leading-tight">{Math.ceil(nearestAmbulance.distance * 3)} mins</p>
                    </div>
                  )}
                </div>

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
                       <p className="text-[11px] text-gray-500 font-medium">{targetHospitalInfo.address}</p>
                     </div>
                   </div>
                </div>

                <div className="mb-6">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Ambulance Type</p>
                  <div className="flex gap-2">
                    <button onClick={() => setAmbulanceType('BLS')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${ambulanceType === 'BLS' ? 'bg-primary-50 text-primary-700 border-primary-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>Basic (BLS)</button>
                    <button onClick={() => setAmbulanceType('ALS')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${ambulanceType === 'ALS' ? 'bg-red-50 text-red-700 border-red-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>ICU (ALS)</button>
                    <button onClick={() => setAmbulanceType('NICU')} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${ambulanceType === 'NICU' ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}>NICU</button>
                  </div>
                </div>

                {nearestAmbulance && (
                  <button 
                    onClick={() => handleRequestAmbulance(nearestAmbulance.id)}
                    disabled={bookingState?.id === nearestAmbulance.id}
                    className={`w-full py-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm
                      ${bookingState?.id === nearestAmbulance.id 
                        ? bookingState.status === 'confirmed' ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-amber-500 text-white shadow-amber-500/20'
                        : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 hover:shadow-md shadow-red-500/20 active:scale-95'}`}
                  >
                    {bookingState?.id === nearestAmbulance.id 
                      ? (bookingState.status === 'confirmed' ? <><CheckCircle2 className="w-5 h-5"/> Dispatched Successfully</> : <><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</>)
                      : 'Confirm Dispatch'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Nearest Ambulance Card (Default) */}
                {nearestAmbulance && (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex-1 animate-fade-in-up">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100">
                          <img src="https://cdn-icons-png.flaticon.com/512/1032/1032986.png" className="w-7 h-7" alt="Ambulance" />
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
                            ? bookingState.status === 'confirmed' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-amber-500 text-white'
                            : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'}`}
                      >
                        {bookingState?.id === nearestAmbulance.id 
                          ? bookingState.status === 'confirmed' ? 'Dispatched' : <Loader2 className="w-4 h-4 animate-spin" />
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
