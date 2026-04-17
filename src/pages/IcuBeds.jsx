import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2 as Hospital, Navigation2, Activity, ShieldPlus, MapPin, Phone, Loader2, Filter, CheckCircle2, Search, Crosshair, Clock, Eye, PlusSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const defaultIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const LocationMarker = ({ position, setPosition, setAddress }) => {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  useMapEvents({
    click(e) {
      const newPos = e.latlng;
      setPosition([newPos.lat, newPos.lng]);
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos.lat}&lon=${newPos.lng}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.display_name) {
             setAddress(data.display_name);
          }
        }).catch(err => console.error(err));
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={defaultIcon}>
      <Popup>Selected Location</Popup>
    </Marker>
  );
};

// ======= FEATURE 1: Location Prompt Component =======
const LocationPrompt = ({ onLocationSelected }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const [mapPosition, setMapPosition] = useState([19.0760, 72.8777]); // Default Mumbai
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&accept-language=en&q=${encodeURIComponent(query)}&limit=5`);
        if (!res.ok) throw new Error("API responded with error");
        const data = await res.json();
        
        if (data.length > 0) {
           setSuggestions(data);
        }
      } catch (e) {
        console.error("Geocoding failed", e);
      }
      setIsSearching(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleUseGPS = () => {
    setIsLocating(true);

    const fallbackToIP = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
           const newPos = [data.latitude, data.longitude];
           setMapPosition(newPos);
           setAddress(`${data.city || 'Unknown City'}, ${data.region || 'Unknown Region'}`);
        } else {
           alert("Unable to detect location automatically. Please select it on the map.");
        }
      } catch(e) {
        alert("Unable to detect location automatically. Please select it on the map.");
      }
      setIsLocating(false);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newPos = [pos.coords.latitude, pos.coords.longitude];
        setMapPosition(newPos);
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPos[0]}&lon=${newPos[1]}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.display_name) {
               setAddress(data.display_name || 'Your Current Location');
            } else {
               setAddress('Your Current Location');
            }
          }).catch(() => setAddress('Your Current Location'));
      },
      (err) => {
        console.warn("Native GPS failed, falling back to IP Geolocation API", err);
        fallbackToIP();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const handleSelectPlace = (place) => {
    const newPos = [parseFloat(place.lat), parseFloat(place.lon)];
    setMapPosition(newPos);
    setAddress(place.display_name);
    setQuery('');
    setSuggestions([]);
  };

  const handleConfirm = () => {
    onLocationSelected({ lat: mapPosition[0], lng: mapPosition[1], address: address || 'Selected Location' });
  };

  return (
    <div className="flex flex-col min-h-[85vh] items-center justify-center p-5 bg-white overflow-hidden relative">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none translate-y-1/3 -translate-x-1/3"></div>

      <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-3xl shadow-2xl shadow-gray-200/50 p-6 relative z-10">
        
        <h2 className="text-xl font-extrabold text-gray-900 text-center mb-1 tracking-tight">Select Your Location</h2>
        <p className="text-xs text-gray-500 text-center mb-6 font-medium">We need your location to find the nearest available ICU beds instantly.</p>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <button 
            onClick={handleUseGPS}
            disabled={isLocating}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
            {isLocating ? 'Detecting...' : 'Use My GPS'}
          </button>
          
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              placeholder="Search area..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              </div>
            )}
            
            {/* Auto-suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden absolute w-full z-[1000] max-h-48 overflow-y-auto">
                {suggestions.map((place, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectPlace(place)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-start gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-700 font-medium line-clamp-2 leading-tight">
                      {place.display_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-[250px] rounded-xl overflow-hidden shadow-inner border border-gray-200 mb-4 z-0">
          <MapContainer 
            center={mapPosition} 
            zoom={13} 
            className="w-full h-full z-0"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap &copy; CARTO'
            />
            <LocationMarker position={mapPosition} setPosition={setMapPosition} setAddress={setAddress} />
          </MapContainer>
        </div>
        
        {address && (
          <div className="bg-gray-50 p-3 rounded-xl mb-4 border border-gray-100 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-700 font-medium leading-tight">{address}</p>
          </div>
        )}

        <button 
          onClick={handleConfirm}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center"
        >
          Confirm Location
        </button>

      </div>
    </div>
  );
};

// ======= MAIN COMPONENT =======
const IcuBeds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Step Management
  const [step, setStep] = useState(0); // 0 = Location Selection, 1 = Hospital List
  const [location, setLocation] = useState(null);
  
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [distanceFilter, setDistanceFilter] = useState(100); 
  const [availabilityFilter, setAvailabilityFilter] = useState('All'); 
  const [specializationFilter, setSpecializationFilter] = useState('All');
  
  const [allSpecializations, setAllSpecializations] = useState([]);
  const [bookingState, setBookingState] = useState(null); 

  // Trigger hospital fetch and live subscription once location is acquired
  useEffect(() => {
    if (step === 1 && location) {
      fetchHospitals(location);

      const channel = supabase.channel('icu-updates-list')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hospital_admins' }, (payload) => {
          setHospitals(prev => prev.map(h => {
            if (h.id === payload.new.id) {
              return { ...h, icuBeds: payload.new.available_icu_beds || 0 };
            }
            return h;
          }));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [step, location]);

  const fetchHospitals = async (loc) => {
    setLoading(true);
    const { data } = await supabase
      .from('hospital_admins')
      .select('id, full_name, city, state, address, lat, lng, available_icu_beds, specializations, phone');

    if (data) {
      const specSet = new Set();
      data.forEach(h => {
        if (h.specializations) {
          h.specializations.forEach(s => specSet.add(s));
        }
      });
      setAllSpecializations(['All', ...Array.from(specSet)]);

      const searchKeywords = loc.address ? loc.address.toLowerCase().split(/[\\s,]+/) : [];

      const withDistance = data.map(h => {
        let dist = Infinity;
        if (h.lat && h.lng && loc.lat && loc.lng) {
          dist = getDistance(loc.lat, loc.lng, h.lat, h.lng);
        }

        // Keyword Match Fallback
        const hospText =(h.full_name + " " + h.address + " " + h.city).toLowerCase();
        let hasKeywordMatch = false;
        
        // If they don't have lat/lng but match the city/address keywords, give them a synthetic 0km distance
        if (searchKeywords.length > 0 && searchKeywords.some(kw => kw.length > 3 && hospText.includes(kw))) {
            hasKeywordMatch = true;
            if (dist === Infinity) dist = 0.5; // Simulate a close distance if it's a keyword match but no GPS
            // If GPS places it far away, but they searched exactly for this hospital name or area, we can still show it
        }

        const etaMins = dist !== Infinity ? Math.ceil(dist * 2 + 3) : 15;
        return {
          ...h,
          distance: dist,
          eta: etaMins,
          icuBeds: h.available_icu_beds || 0,
          specializations: h.specializations || [],
          isKeywordMatch: hasKeywordMatch
        };
      }).sort((a, b) => a.distance - b.distance);
      
      setHospitals(withDistance);
    }
    setLoading(false);
  };

  const handleLocationSelected = (locData) => {
    setLocation(locData);
    setStep(1);
  };

  const handleBookICU = (id) => {
    setBookingState({ id, status: 'requesting' });
    setTimeout(() => {
      setHospitals(prev => prev.map(h => h.id === id ? { ...h, icuBeds: Math.max(0, h.icuBeds - 1) } : h));
      setBookingState({ id, status: 'confirmed' });
    }, 2000);
  };

  // Render Step 0: Location Prompt
  if (step === 0) {
    return <LocationPrompt onLocationSelected={handleLocationSelected} />;
  }

  // Render Step 1: Loading Hospitals
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
            <Activity className="w-8 h-8 text-red-500" />
          </div>
          <div className="absolute -inset-4 border-2 border-red-500 rounded-full animate-ping opacity-20"></div>
        </div>
        <p className="mt-4 text-sm font-bold text-gray-500 tracking-widest uppercase">Finding nearest hospitals...</p>
      </div>
    );
  }

  // Determine filtered hospitals
  const filteredHospitals = hospitals.filter(h => {
    // Show if within distance OR if it was an explicit keyword match for their typed location
    if (h.distance > distanceFilter && !h.isKeywordMatch) return false;
    if (availabilityFilter === 'Available' && h.icuBeds < 3) return false;
    if (availabilityFilter === 'Limited' && (h.icuBeds === 0 || h.icuBeds >= 3)) return false;
    if (availabilityFilter === 'Full' && h.icuBeds > 0) return false;
    if (specializationFilter !== 'All' && !h.specializations.includes(specializationFilter)) return false;
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-gray-50/50 relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
      
      {/* Header */}
      <div className="bg-white sticky top-0 z-40 px-5 pt-6 pb-4 border-b border-gray-100 shadow-sm backdrop-blur-xl bg-white/80">
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 p-2.5 rounded-2xl">
              <Hospital className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">ICU Availability</h1>
              <button 
                onClick={() => setStep(0)}
                className="text-gray-500 hover:text-red-600 transition-colors text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5"
                title="Change Location"
              >
                <MapPin className="w-3 h-3 text-red-400" /> {location?.address?.split(',')[0]} (Change)
              </button>
            </div>
          </div>
          <button onClick={() => navigate('/emergency')} className="bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-red-500/20 hover:shadow-lg transition-all active:scale-95 flex items-center gap-2">
            <Navigation2 className="w-4 h-4" /> Map View
          </button>
        </div>

        {/* Filters */}
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-3">
             <Filter className="w-4 h-4 text-gray-400 shrink-0" />
             <div className="flex-1 flex items-center gap-2">
               <span className="text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">Max Dist:</span>
               <input 
                 type="range" min="1" max="100" 
                 value={distanceFilter} 
                 onChange={(e) => setDistanceFilter(parseInt(e.target.value))}
                 className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
               />
               <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{distanceFilter} km</span>
             </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={availabilityFilter} 
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-100 text-gray-700 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-red-100 appearance-none"
            >
              <option value="All">All Availabilities</option>
              <option value="Available">Available (3+ beds)</option>
              <option value="Limited">Limited (1-2 beds)</option>
              <option value="Full">Full (0 beds)</option>
            </select>

            <select 
              value={specializationFilter} 
              onChange={(e) => setSpecializationFilter(e.target.value)}
              className="flex-1 bg-gray-50 border border-gray-100 text-gray-700 text-xs font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-red-100 appearance-none"
            >
              {allSpecializations.map(spec => (
                <option key={spec} value={spec}>{spec} Specialization</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-5 py-6">
        
        <div className="flex items-center justify-between mb-5">
           <p className="text-sm font-medium text-gray-500">Showing <span className="font-bold text-gray-900">{filteredHospitals.length}</span> hospitals near you</p>
        </div>

        {filteredHospitals.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-gray-100/50">
            <ShieldPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">No hospitals found</h3>
            <p className="text-sm text-gray-500 font-medium">Try increasing the distance radius or changing your filters.</p>
            <button 
              onClick={() => { setDistanceFilter(100); setAvailabilityFilter('All'); setSpecializationFilter('All'); }}
              className="mt-6 text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 px-5 py-2.5 rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredHospitals.map(hospital => {
              const isAvailable = hospital.icuBeds >= 3;
              const isLimited = hospital.icuBeds > 0 && hospital.icuBeds < 3;
              const isFull = hospital.icuBeds === 0;

              return (
                <div key={hospital.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-100 hover:-translate-y-1 transition-all duration-300 group">
                  <div className={`h-2 w-full ${isAvailable ? 'bg-green-500' : isLimited ? 'bg-amber-400' : 'bg-red-500'}`}></div>
                  
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-extrabold text-gray-900 text-lg mb-1 truncate">{hospital.full_name}</h3>
                        <p className="text-[11px] font-bold text-gray-400 flex items-center gap-1 uppercase tracking-wider">
                           <MapPin className="w-3 h-3" /> {hospital.distance.toFixed(1)} km away • {hospital.city}
                        </p>
                        <p className="text-[11px] font-bold text-indigo-500 flex items-center gap-1 uppercase tracking-wider mt-0.5">
                           <Clock className="w-3 h-3" /> {hospital.eta} mins travel time
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`inline-flex flex-col items-center justify-center px-3 py-1.5 rounded-xl border ${
                          isAvailable ? 'bg-green-50 border-green-100' : 
                          isLimited ? 'bg-amber-50 border-amber-100' : 
                          'bg-red-50 border-red-100'
                        }`}>
                          <span className={`text-2xl font-black leading-none mb-0.5 ${
                             isAvailable ? 'text-green-600' : 
                             isLimited ? 'text-amber-600' : 
                             'text-red-600'
                          }`}>{hospital.icuBeds}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${
                             isAvailable ? 'text-green-600/70' : 
                             isLimited ? 'text-amber-600/70' : 
                             'text-red-600/70'
                          }`}>Beds</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-5 mt-4">
                      {hospital.specializations.map((spec, i) => (
                        <span key={i} className="bg-gray-50 border border-gray-100 text-gray-600 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide">
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
                      {hospital.phone && (
                         <a href={`tel:${hospital.phone}`} className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 border border-gray-100">
                           <Phone className="w-4 h-4" />
                         </a>
                      )}
                      
                      {isFull ? (
                        <div className="flex-1 flex gap-2">
                           <button 
                             onClick={() => navigate(`/hospital/${hospital.id}`)}
                             className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                           >
                             <Eye className="w-4 h-4" /> Details
                           </button>
                           <button disabled className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100 cursor-not-allowed">
                             No Beds
                           </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex gap-2">
                           <button 
                             onClick={() => navigate(`/hospital/${hospital.id}`)}
                             className="flex-1 h-11 rounded-xl text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors flex items-center justify-center gap-1.5"
                           >
                             <Eye className="w-4 h-4" /> Details
                           </button>
                           <button 
                             onClick={() => navigate(`/emergency?hosp=${hospital.id}&lat=${location.lat}&lng=${location.lng}&eta=${hospital.eta}`)}
                             className="flex-1 h-11 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-md shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                           >
                             <PlusSquare className="w-4 h-4" /> Book Amb.
                           </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IcuBeds;
