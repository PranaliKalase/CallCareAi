import React, { useState, useEffect } from 'react';
import {
  MapPin, Calendar, Clock, ArrowLeft, Building2, CheckCircle2,
  History, Navigation2, Loader2, Phone, ChevronLeft, ChevronRight,
  Ticket, User, Stethoscope, Search, FileText, Pill, Activity,
  Heart, Thermometer, TrendingUp, Droplets, Wind, Eye,
  ChevronDown, ChevronUp, ClipboardList, X, Filter
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isBefore, startOfDay, getDay
} from 'date-fns';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── Leaflet icon fix ──
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063176.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const userIcon = new L.DivIcon({
  html: `<div style="width:18px;height:18px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  className: '',
});

// ── Auto-fit map bounds to show all markers ──
function FitBounds({ userLocation, hospitals }) {
  const map = useMap();
  useEffect(() => {
    const points = [];
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    hospitals.filter(h => h.lat && h.lng).forEach(h => points.push([h.lat, h.lng]));
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    }
  }, [userLocation, hospitals, map]);
  return null;
}

// ══════════════════════════════════════════════════
//  CALENDAR COMPONENT
// ══════════════════════════════════════════════════
const SlotCalendar = ({ selectedDate, onSelectDate, slotDates }) => {
  const [viewMonth, setViewMonth] = useState(new Date());

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of first week with nulls so dates land on correct weekday columns
  const startPad = getDay(monthStart); // 0=Sun
  const paddedDays = [...Array(startPad).fill(null), ...allDays];

  const prevMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1));
  const nextMonth = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1));

  const hasSlots = (day) => {
    return slotDates.some(d => {
      const [y, m, dd] = d.split('-').map(Number);
      return isSameDay(new Date(y, m - 1, dd), day);
    });
  };

  const isPast = (day) => isBefore(day, startOfDay(new Date()));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-gray-900">{format(viewMonth, 'MMMM yyyy')}</h4>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <span key={d} className="text-[10px] font-semibold text-gray-400 uppercase text-center py-1">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {paddedDays.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;

          const active = selectedDate && isSameDay(day, selectedDate);
          const available = hasSlots(day) && !isPast(day);
          const past = isPast(day);

          return (
            <button
              key={idx}
              disabled={!available}
              onClick={() => onSelectDate(day)}
              className={`relative flex flex-col items-center justify-center py-2 rounded-xl transition-all
                ${active ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300' : ''}
                ${available && !active ? 'hover:bg-primary-50 cursor-pointer' : ''}
                ${!available && !active ? 'cursor-default' : ''}
                ${past ? 'opacity-30' : ''}
              `}
            >
              <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-700'}`}>
                {format(day, 'd')}
              </span>
              {available && !active && (
                <div className="w-1 h-1 bg-primary-500 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import { useLocation } from 'react-router-dom';

// ══════════════════════════════════════════════════
//  MAIN BOOKINGS COMPONENT
// ══════════════════════════════════════════════════
const Bookings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('hospitals');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hospitalError, setHospitalError] = useState(null);

  // Hospital list
  const [hospitals, setHospitals] = useState([]);
  const [locationPerm, setLocationPerm] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Derive unique states & cities from hospital data
  const uniqueStates = [...new Set(hospitals.map(h => h.state).filter(Boolean))].sort();
  const uniqueCities = [...new Set(
    hospitals
      .filter(h => !filterState || h.state === filterState)
      .map(h => h.city)
      .filter(Boolean)
  )].sort();

  // Filtered hospital list (state → city → search text)
  const filteredHospitals = hospitals.filter(h => {
    if (filterState && h.state !== filterState) return false;
    if (filterCity && h.city !== filterCity) return false;
    if (search && !h.name?.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  // Booking state
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalSlots, setHospitalSlots] = useState([]);
  const [slotDates, setSlotDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [createdAppointment, setCreatedAppointment] = useState(null);

  useEffect(() => {
    if (user) {
      fetchHospitals();
    }
  }, [userLocation, user?.id]); // Trigger reliably

  // ── Location ──
  const requestLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationPerm(true);
        setLoading(false);
      },
      () => {
        setLocationPerm(true);
        setLoading(false);
      }
    );
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // ── Fetch hospitals ──
  const fetchHospitals = async () => {
    try {
      setHospitalError(null);
      const { data, error } = await supabase.from('hospital_admins').select('*');
      if (error) throw error;
      const sorted = (data || []).map(h => ({
        ...h,
        name: h.full_name,
        distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, h.lat, h.lng) : 999,
        type: 'Medical Centre',
      })).sort((a, b) => a.distance - b.distance);
      setHospitals(sorted);
    } catch (err) { 
      console.error('fetchHospitals:', err);
      setHospitalError(err.message || String(err));
    }
  };

  // ── Open hospital → step 2 ──
  const openHospital = async (hospital) => {
    setSelectedHospital(hospital);
    setStep(2);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedDoctor(null);
    setLoading(true);
    try {
      const [{ data: docs }, { data: apts }, { data: slots }] = await Promise.all([
        supabase.from('doctors').select('*').eq('hospital_name', hospital.name).eq('is_approved', true),
        supabase.from('appointments').select('slot_id, doctor_id').eq('hospital_id', hospital.id),
        supabase.from('hospital_slots').select('*').eq('hospital_id', hospital.id)
          .gte('slot_date', format(new Date(), 'yyyy-MM-dd'))
          .order('slot_date').order('start_time'),
      ]);
      setDoctors(docs || []);
      setAppointments(apts || []);
      setHospitalSlots(slots || []);
      setSlotDates([...new Set((slots || []).map(s => s.slot_date))]);
    } catch (err) { console.error('openHospital:', err); }
    finally { setLoading(false); }
  };

  // ── Book appointment ──
  const executeBooking = async () => {
    if (!selectedSlot || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('appointments').insert([{
        patient_id: user.id,
        hospital_id: selectedHospital.id,
        slot_id: selectedSlot.id,
        doctor_id: selectedDoctor?.id || null,
        status: 'confirmed',
      }]).select().single();
      if (error) throw error;

      setCreatedAppointment({
        ...data,
        hospital_name: selectedHospital.name,
        doctor_name: selectedDoctor?.full_name,
        slot_date: selectedSlot.slot_date,
        start_time: selectedSlot.start_time,
      });
      setStep(3);
    } catch (err) { alert('Booking failed: ' + err.message); }
    finally { setLoading(false); }
  };

  // ── Filtered slots for selected date & doctor ──
  const slotsForDate = (selectedDate && selectedDoctor)
    ? hospitalSlots
        .filter(s => s.slot_date === format(selectedDate, 'yyyy-MM-dd') && s.doctor_id === selectedDoctor.id)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : [];

  // ══════════════════
  //  MAIN RENDER
  // ══════════════════

  // ══════════════════════════════
  //  LOCATION PERMISSION SCREEN
  // ══════════════════════════════
  if (!locationPerm && activeTab === 'hospitals') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-gray-50">
        <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary-50">
          <MapPin className="w-10 h-10 text-primary-600 animate-bounce" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Find Nearby Hospitals</h2>
        <p className="text-gray-500 mb-8 max-w-sm text-sm">
          Enable location to see hospitals near you and book appointments instantly.
        </p>
        <button
          onClick={requestLocation}
          disabled={loading}
          className="w-full max-w-xs py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold shadow-lg shadow-primary-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Navigation2 className="w-5 h-5" /> Find Nearby Hospitals</>}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-6 bg-gray-50">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-8 pb-5">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
            {step === 1 ? 'Book Appointment' : step === 2 ? selectedHospital?.name : 'Booking Confirmed'}
          </h1>
          <p className="text-xs text-gray-400 font-medium">
            {step === 1 ? 'Find & book the best healthcare near you' : step === 2 ? 'Select doctor, date & time' : 'Your token is ready'}
          </p>
          {/* Step progress */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? 'bg-primary-500 w-10' : 'bg-gray-200 w-6'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5">



        {/* ════════════════════════════════════
            STEP 1 — HOSPITAL LIST + MAP
        ════════════════════════════════════ */}
        {activeTab === 'hospitals' && step === 1 && (
          <div className="animate-fade-in-up">

            {/* ── MAP ── */}
            {userLocation && (
              <div className="mb-5 rounded-2xl overflow-hidden shadow-lg border border-gray-200" style={{ height: 280 }}>
                <MapContainer
                  center={[userLocation.lat, userLocation.lng]}
                  zoom={13}
                  scrollWheelZoom={true}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds userLocation={userLocation} hospitals={filteredHospitals} />
                  {/* Current location marker */}
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                    <Popup>
                      <div style={{textAlign:'center',fontWeight:600,fontSize:13}}>📍 Your Location</div>
                    </Popup>
                  </Marker>
                  {/* Hospital markers */}
                  {filteredHospitals.filter(h => h.lat && h.lng).map(h => (
                    <Marker key={h.id} position={[h.lat, h.lng]} icon={hospitalIcon}>
                      <Popup>
                        <div style={{minWidth:140}}>
                          <b style={{fontSize:13}}>{h.name}</b><br/>
                          <span style={{fontSize:11,color:'#666'}}>{h.city}{h.state ? `, ${h.state}` : ''}</span><br/>
                          {h.distance < 900 && <span style={{fontSize:11,color:'#2563eb',fontWeight:600}}>{h.distance.toFixed(1)} km away</span>}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}

            {/* ── Search ── */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search hospitals..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* ── State & City Filters ── */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select
                  value={filterState}
                  onChange={(e) => { setFilterState(e.target.value); setFilterCity(''); }}
                  className={`w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    filterState ? 'border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">All States</option>
                  {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 bg-white border rounded-xl text-xs font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all ${
                    filterCity ? 'border-primary-300 text-primary-700' : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <option value="">All Cities</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {(filterState || filterCity) && (
                <button
                  onClick={() => { setFilterState(''); setFilterCity(''); }}
                  className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition-all flex items-center gap-1 shrink-0"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* ── Hospital Count ── */}
            <p className="text-xs font-semibold text-gray-500 mb-3">
              {filteredHospitals.length} hospital{filteredHospitals.length !== 1 ? 's' : ''} found
              {filterState && <span className="text-primary-600"> in {filterState}</span>}
              {filterCity && <span className="text-primary-600">, {filterCity}</span>}
            </p>

            {/* ── Hospital Cards ── */}
            <div className="space-y-4 pb-10">
              {filteredHospitals
                .map(h => (
                  <div
                    key={h.id}
                    onClick={() => openHospital(h)}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-primary-200 transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-primary-100 transition-colors">
                        <Building2 className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-gray-900 text-sm leading-tight">{h.name}</h3>
                          <span className="shrink-0 px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold rounded-full border border-green-100 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {h.distance < 900 && (
                            <span className="text-[10px] text-primary-600 font-semibold flex items-center gap-0.5">
                              <Navigation2 className="w-2.5 h-2.5" /> {h.distance.toFixed(1)} km
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {h.city}{h.state ? `, ${h.state}` : ''}
                          </span>
                        </div>
                        {h.phone && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                            <Phone className="w-2.5 h-2.5" /> {h.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            STEP 2 — BOOKING FLOW
        ════════════════════════════════════ */}
        {step === 2 && selectedHospital && (
          <div className="animate-fade-in-up pb-28">

            {/* Back button */}
            <button
              onClick={() => { setStep(1); setSelectedSlot(null); setSelectedDate(null); }}
              className="flex items-center text-sm text-primary-700 font-semibold mb-5 hover:text-primary-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to hospitals
            </button>

            {/* Hospital info card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selectedHospital.name}</h2>
                  <p className="text-xs text-gray-400">{selectedHospital.address ? `${selectedHospital.address}, ` : ''}{selectedHospital.city}</p>
                </div>
              </div>
            </div>

            {/* ── Doctor Selection (Mandatory) ── */}
            <div className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Stethoscope className="w-3.5 h-3.5" /> Select Doctor
              </h3>
              
              {!loading && doctors.length === 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-center">
                  <p className="text-sm font-medium text-gray-500">No verified doctors available at this hospital yet.</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                  {/* Removed Any Available option - Doctor explicitly required */}
                  {doctors.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDoctor(doc)}
                      className={`shrink-0 w-28 p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center
                        ${selectedDoctor?.id === doc.id ? 'bg-primary-50 border-primary-500 shadow-md' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${selectedDoctor?.id === doc.id ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-500'}`}>
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold leading-tight truncate w-full text-gray-700">{doc.full_name}</span>
                      <span className="text-[8px] text-gray-400 mt-0.5 truncate w-full">{doc.specialization || 'Specialist'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Calendar ── */}
            <div className={`mb-5 transition-opacity duration-300 ${!selectedDoctor ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Select Date {!selectedDoctor && <span className="text-red-500 normal-case ml-1 font-medium bg-red-50 px-2 py-0.5 rounded text-[10px]">Please select a doctor first</span>}
              </h3>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-primary-500 animate-spin" /></div>
              ) : (
                <SlotCalendar 
                  selectedDate={selectedDate} 
                  onSelectDate={setSelectedDate} 
                  slotDates={[...new Set(hospitalSlots.filter(s => selectedDoctor ? s.doctor_id === selectedDoctor.id : false).map(s => s.slot_date))]} 
                />
              )}
            </div>

            {/* ── Time Slots ── */}
            {selectedDate && selectedDoctor && (
              <div className="mb-5 animate-fade-in-up">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> {format(selectedDate, 'EEEE, MMM do')} — Available Times for Dr. {selectedDoctor.full_name.split(' ')[0]}
                </h3>

                {slotsForDate.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
                    <p className="text-sm text-gray-400">No slots available for this date.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slotsForDate.map(slot => {
                      const isOccupied = appointments.some(
                        apt => apt.slot_id === slot.id && (selectedDoctor ? apt.doctor_id === selectedDoctor.id : true)
                      );
                      const isDisabled = slot.is_booked || isOccupied;
                      const isSelected = selectedSlot?.id === slot.id;

                      return (
                        <button
                          key={slot.id}
                          disabled={isDisabled}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-3 rounded-xl text-xs font-bold transition-all border-2
                            ${isSelected
                              ? 'bg-primary-600 border-primary-600 text-white shadow-md scale-[0.97]'
                              : isDisabled
                                ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed line-through'
                                : 'bg-white border-gray-100 text-gray-700 hover:border-primary-300 hover:bg-primary-50 active:scale-95'
                            }`}
                        >
                          {slot.start_time.substring(0, 5)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Floating Confirm Button ── */}
            {selectedSlot && !selectedSlot.is_booked && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-50 pb-safe">
                <button
                  onClick={executeBooking}
                  disabled={loading}
                  className="w-full max-w-md mx-auto block py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><Ticket className="w-5 h-5" /> Confirm & Get Token</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════
            STEP 3 — SUCCESS TICKET
        ════════════════════════════════════ */}
        {step === 3 && createdAppointment && (
          <div className="flex flex-col items-center justify-center text-center animate-fade-in-up py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5 ring-8 ring-green-50">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Appointment Booked!</h2>
            <p className="text-gray-500 text-sm mb-6">Save your token number below</p>

            {/* Ticket Card */}
            <div className="w-full bg-white rounded-3xl p-6 border-2 border-dashed border-primary-200 shadow-sm relative">
              <div className="absolute -left-3 top-1/2 w-6 h-6 bg-gray-50 rounded-full border-r-2 border-primary-200" />
              <div className="absolute -right-3 top-1/2 w-6 h-6 bg-gray-50 rounded-full border-l-2 border-primary-200" />

              <div className="text-[10px] font-bold text-primary-600 tracking-[0.2em] uppercase mb-1">TOKEN NUMBER</div>
              <div className="text-4xl font-black text-gray-900 mb-5 tracking-tight">
                {createdAppointment.token_number || `#${createdAppointment.id.substring(0, 4).toUpperCase()}`}
              </div>

              <div className="space-y-2 text-left">
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-400 font-medium text-xs">Hospital</span>
                  <span className="font-bold text-gray-900 text-xs">{createdAppointment.hospital_name}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-400 font-medium text-xs">Date</span>
                  <span className="font-bold text-gray-900 text-xs">
                    {format(new Date(createdAppointment.slot_date + 'T00:00:00'), 'EEEE, MMM do yyyy')}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-400 font-medium text-xs">Time</span>
                  <span className="font-bold text-gray-900 text-xs">{createdAppointment.start_time.substring(0, 5)}</span>
                </div>
                {createdAppointment.doctor_name && (
                  <div className="flex justify-between items-center bg-primary-50 p-3 rounded-lg border-l-4 border-primary-400">
                    <span className="text-primary-600 font-medium text-xs">Doctor</span>
                    <span className="font-bold text-primary-800 text-xs">Dr. {createdAppointment.doctor_name}</span>
                  </div>
                )}
                <div className="flex justify-between items-center bg-green-50 p-3 rounded-lg">
                  <span className="text-green-600 font-medium text-xs">Status</span>
                  <span className="font-bold text-green-700 text-xs uppercase">{createdAppointment.status}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setStep(1); setActiveTab('history'); setSelectedSlot(null); setSelectedDate(null); fetchHistory(); }}
              className="mt-8 py-3.5 bg-gray-900 text-white rounded-2xl font-bold w-full active:scale-95 transition-transform text-sm"
            >
              View My History
            </button>
          </div>
        )}


      </div>
    </div>
  );
};

export default Bookings;
