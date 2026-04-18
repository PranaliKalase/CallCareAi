import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import { calculateDijkstraPath } from '../utils/DijkstraGraph';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Phone, CheckCircle, XCircle, Power, User as UserIcon } from 'lucide-react';

// Custom Map Icons
const driverIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/8294/8294247.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});
const patientIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3004/3004455.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});
const hospitalIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3004/3004470.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

// Component to dynamically set map center
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], 15);
    }
  }, [center, map]);
  return null;
}

export default function DriverDashboard() {
  const { user, profile } = useAuth();
  
  const [isOnline, setIsOnline] = useState(profile?.status === 'online');
  const [driverLocation, setDriverLocation] = useState(null);
  const [requests, setRequests] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [dijkstraRoute, setDijkstraRoute] = useState([]);
  const [targetHospital, setTargetHospital] = useState(null);
  
  // Realtime subscription ref
  const subRef = useRef(null);

  // ─── INIT & CLEANUP ───
  useEffect(() => {
    // Initial fetch of any active job assigned to this driver
    fetchActiveJob();
    
    // Subscribe to new requests if online
    if (isOnline) {
      startWatchingLocation();
      fetchPendingRequests();
      subscribeToRequests();
    } else {
      stopWatchingLocation();
      setRequests([]);
      if (subRef.current) subRef.current.unsubscribe();
    }
    
    return () => {
      stopWatchingLocation();
      if (subRef.current) subRef.current.unsubscribe();
    };
  }, [isOnline]);

  const fetchActiveJob = async () => {
    const { data } = await supabase
      .from('ambulance_requests')
      .select('*')
      .eq('driver_id', user.id)
      .in('status', ['accepted', 'en_route', 'arriving', 'patient_picked_up'])
      .maybeSingle();

    if (data) {
      setActiveJob(data);
      setIsOnline(true);
      await updateDriverState(true, 'busy');
    }
  };

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from('ambulance_requests')
      .select('*')
      .eq('status', 'requesting')
      .order('created_at', { ascending: false });
      
    if (data) setRequests(data);
  };

  const subscribeToRequests = () => {
    subRef.current = supabase.channel('driver_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulance_requests' }, payload => {
        if (!activeJob) {
          fetchPendingRequests(); // refresh list simply
        } else {
          // If active job changed status directly (maybe patient cancelled)
          if (payload.new.id === activeJob.id) {
            if (payload.new.status === 'completed' || payload.new.status === 'cancelled') {
              setActiveJob(null);
              setIsOnline(true);
              updateDriverState(true, 'online');
            } else {
              setActiveJob(payload.new);
            }
          }
        }
      })
      .subscribe();
  };

  const updateDriverState = async (online, statusStr) => {
    if (!user) return;
    await supabase.from('ambulance_drivers').update({
      available: online && statusStr === 'online',
      status: statusStr
    }).eq('id', user.id);
  };

  const toggleOnlineStatus = async () => {
    if (activeJob) {
      alert("You cannot go offline while serving an active request.");
      return;
    }
    const nextState = !isOnline;
    setIsOnline(nextState);
    await updateDriverState(nextState, nextState ? 'online' : 'offline');
  };

  // ─── GPS TRACKING ───
  const startWatchingLocation = () => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverLocation({ lat, lng });
        
        // Sync to DB so patients can see real-time movement
        await supabase.from('ambulance_drivers').update({
          lat, lng
        }).eq('id', user.id);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setWatchId(id);
  };

  const stopWatchingLocation = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return "Unknown";
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1);
  };

  // ─── JOB ACTIONS ───
  const acceptRequest = async (req) => {
    try {
      // Attempt to lock
      const { data, error } = await supabase
        .from('ambulance_requests')
        .update({ driver_id: user.id, status: 'accepted' })
        .eq('id', req.id)
        .eq('status', 'requesting')
        .select();

      if (error) {
        alert("Database error: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        alert("This request was taken by another driver or cancelled.");
        fetchPendingRequests();
      } else {
        setActiveJob(data[0]);
        await updateDriverState(true, 'busy');
      }
    } catch (err) {
      alert("Runtime Error: " + err.message);
    }
  };

  const updateJobStatus = async (newStatus) => {
    if (!activeJob) return;
    const { data } = await supabase
      .from('ambulance_requests')
      .update({ status: newStatus })
      .eq('id', activeJob.id)
      .select()
      .single();

    if (data) {
      if (newStatus === 'completed') {
        setActiveJob(null);
        setDijkstraRoute([]);
        setTargetHospital(null);
        await updateDriverState(true, 'online');
      } else {
        setActiveJob(data);

        // If patient is picked up, calculate Dijkstra path to destination hospital
        if (newStatus === 'patient_picked_up' && data.dropoff_hospital_id && driverLocation) {
          const { data: hosp } = await supabase.from('hospital_admins').select('lat, lng, full_name').eq('id', data.dropoff_hospital_id).maybeSingle();
          if (hosp && hosp.lat && hosp.lng) {
            setTargetHospital(hosp);
            const path = calculateDijkstraPath(driverLocation, hosp);
            setDijkstraRoute(path);
          }
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">
      
      {/* HEADER TABS */}
      <div className="bg-white shadow-sm z-10 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">Driver Hub</h1>
          <p className="text-xs text-gray-500 font-medium">Vehicle: {profile?.vehicle_number || 'Unassigned'} • {profile?.type}</p>
        </div>
        
        {/* ONLINE TOGGLE */}
        <button 
          onClick={toggleOnlineStatus}
          disabled={!!activeJob}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50
            ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${isOnline ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* ONLINE STATUS CARD */}
      <div className={`px-4 py-2 text-center text-xs font-bold text-white shadow-md z-10 transition-colors
        ${isOnline ? (activeJob ? 'bg-blue-600' : 'bg-green-500') : 'bg-gray-500'}`}
      >
        {isOnline ? (activeJob ? 'Currently in an Emergency Rescue' : 'ONLINE - Waiting for Emergency Requests') : 'OFFLINE - Not Receiving Requests'}
      </div>

      {/* MAP AREA */}
      <div className="flex-1 relative bg-gray-200">
        <MapContainer 
          center={[19.0760, 72.8777]} 
          zoom={13} 
          scrollWheelZoom={true} 
          className="w-full h-full z-0"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          
          {driverLocation && (
            <>
              <ChangeView center={driverLocation} />
              <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon} zIndexOffset={1000}>
                <Popup><b>You are here</b></Popup>
              </Marker>
            </>
          )}

          {activeJob && activeJob.status !== 'patient_picked_up' && (
            <Marker position={[activeJob.pickup_lat, activeJob.pickup_lng]} icon={patientIcon}>
              <Popup><b>Patient Location</b></Popup>
            </Marker>
          )}

          {targetHospital && (
            <Marker position={[targetHospital.lat, targetHospital.lng]} icon={hospitalIcon} zIndexOffset={900}>
              <Popup><b>{targetHospital.full_name || 'Dropoff Hospital'}</b></Popup>
            </Marker>
          )}

          {dijkstraRoute.length > 0 && (
            <Polyline 
              positions={dijkstraRoute.map(p => [p.lat, p.lng])} 
              pathOptions={{ color: '#0ea5e9', weight: 6, opacity: 0.8 }} 
            />
          )}
        </MapContainer>

        {/* GPS TARGET BUTTON */}
        <button className="absolute bottom-6 right-4 z-10 p-3 bg-white rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 text-gray-700">
          <Navigation className="w-5 h-5 fill-current" />
        </button>
      </div>

      {/* BOTTOM SHEET: REQUESTS OR ACTIVE JOB */}
      {isOnline && (
        <div className="relative z-50 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl border-t border-gray-100 max-h-[50vh] overflow-y-auto">
          
          {/* GRABBER */}
          <div className="w-full flex justify-center pt-3 pb-2 sticky top-0 bg-white z-10" onClick={() => {}}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
          </div>

          <div className="px-5 pb-8">
            {activeJob ? (
              /* ACTIVE JOB CONTROLS */
              <div className="space-y-4 animate-fade-in-up">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-0.5">Active Mission</p>
                    <h2 className="text-lg font-bold text-gray-800">{activeJob.patient_name || 'Emergency Patient'}</h2>
                  </div>
                  <a href={`tel:${activeJob.patient_phone || ''}`} className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 shadow-sm border border-green-100">
                    <Phone className="w-5 h-5" />
                  </a>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => updateJobStatus('en_route')}
                    disabled={activeJob.status !== 'accepted'}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm
                      ${activeJob.status === 'accepted' ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-400'}`}
                  >
                    I Have Left (En Route)
                  </button>
                  <button 
                    onClick={() => updateJobStatus('arriving')}
                    disabled={activeJob.status !== 'en_route'}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm
                      ${activeJob.status === 'en_route' ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    Arriving at Patient Location
                  </button>
                  <button 
                    onClick={() => updateJobStatus('patient_picked_up')}
                    disabled={activeJob.status !== 'arriving'}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm
                      ${activeJob.status === 'arriving' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400'}`}
                  >
                    Patient Picked Up
                  </button>
                  <button 
                    onClick={() => updateJobStatus('completed')}
                    disabled={activeJob.status !== 'patient_picked_up'}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all shadow-sm
                      ${activeJob.status === 'patient_picked_up' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-100 text-gray-400'}`}
                  >
                    Reached Hospital & Completed
                  </button>
                </div>
              </div>

            ) : (
              /* PENDING REQUESTS LIST */
              <div className="space-y-4">
                <h2 className="text-gray-800 font-bold px-1">Live Requests ({requests.length})</h2>
                
                {requests.length === 0 ? (
                  <div className="text-center py-6 pb-10">
                    <div className="w-16 h-16 bg-blue-50 text-blue-200 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Power className="w-8 h-8" />
                    </div>
                    <p className="text-gray-500 font-medium text-sm">Searching for patients in your area...</p>
                  </div>
                ) : (
                  requests.map(req => {
                    const dist = driverLocation ? getDistance(driverLocation.lat, driverLocation.lng, req.pickup_lat, req.pickup_lng) : '—';
                    return (
                      <div key={req.id} className="bg-white border-2 border-primary-100 p-4 rounded-2xl shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] flex flex-col gap-4 animate-fade-in-up">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold">
                              {req.patient_name?.charAt(0) || '!'}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800 text-base leading-tight">{req.patient_name || 'Emergency Patient'}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">{dist} km away from your location</p>
                            </div>
                          </div>
                          <span className="bg-red-50 text-red-600 text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-wider">
                            URGENT
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => acceptRequest(req)} 
                            className="flex-1 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-primary-600/30 active:scale-95 transition-all text-sm"
                          >
                            <CheckCircle className="w-4 h-4" /> ACCEPT
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
