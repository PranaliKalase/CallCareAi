import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Home as HomeIcon, Calendar as CalendarIcon, PhoneCall, User as UserIcon, Bell, LogOut, History, Building, Globe, Activity, PlusSquare } from 'lucide-react';

// Lazy-load all pages for faster initial load
const AuthPage = lazy(() => import('./pages/AuthPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Home = lazy(() => import('./pages/Home'));
const Bookings = lazy(() => import('./pages/Bookings'));
const Profile = lazy(() => import('./pages/Profile'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const HospitalDashboard = lazy(() => import('./pages/HospitalDashboard'));
const Records = lazy(() => import('./pages/Records'));
const SymptomChecker = lazy(() => import('./pages/SymptomChecker'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const EmergencyTracker = lazy(() => import('./pages/EmergencyTracker'));
const IcuBeds = lazy(() => import('./pages/IcuBeds'));
const HospitalDetail = lazy(() => import('./pages/HospitalDetail'));
const RoomAllocation = lazy(() => import('./pages/RoomAllocation'));

// Protected Route Wrapper
const ProtectedRoute = ({ children, roleRequired }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  
  if (roleRequired === 'doctor' && profile?.role !== 'doctor') {
    return <Navigate to="/home" />;
  }

  if (roleRequired === 'hospital' && profile?.role !== 'hospital') {
    return <Navigate to="/home" />;
  }
  
  if (roleRequired === 'driver' && profile?.role !== 'driver') {
    return <Navigate to="/home" />;
  }
  
  return children;
};

// Top Bar
const TopBar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const langRef = useRef(null);
  
  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'mr', name: 'मराठी', flag: '🇮🇳' },
    { code: 'gu', name: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'ta', name: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'తెలుగు', flag: '🇮🇳' },
    { code: 'kn', name: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'മലയാളം', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'ur', name: 'اردو', flag: '🇵🇰' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh-CN', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerTranslate = (langCode) => {
    setCurrentLang(langCode);
    setShowLangMenu(false);

    // Set the Google Translate cookie to trigger translation
    const domain = window.location.hostname;
    document.cookie = `googtrans=/en/${langCode}; path=/; domain=${domain}`;
    document.cookie = `googtrans=/en/${langCode}; path=/`;

    // Find and trigger the Google Translate select element
    const selectEl = document.querySelector('.goog-te-combo');
    if (selectEl) {
      selectEl.value = langCode;
      selectEl.dispatchEvent(new Event('change'));
    } else {
      // If widget hasn't loaded yet, reload with cookie set
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  
  const activeLang = languages.find(l => l.code === currentLang);

  return (
    <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl px-5 py-3 flex items-center justify-between border-b border-gray-100/80">
      <div className="flex items-center space-x-3">
        <img src="/carepluslogo.jpeg" alt="Careplus" className="w-9 h-9 rounded-xl object-contain shadow-sm" />
        <span className="font-bold text-base text-gray-800 tracking-tight">Careplus</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {/* TopBar Ambulance Button (Patients only) */}
        {profile?.role === 'patient' && (
          <button 
            onClick={() => navigate('/emergency')}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-colors border border-red-100"
          >
            <PlusSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Book Ambulance</span>
          </button>
        )}

        {/* Translate Button */}
        <div ref={langRef} className="relative">
          <button 
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
              showLangMenu ? 'bg-primary-50 text-primary-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">{activeLang?.flag} {activeLang?.name || 'EN'}</span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[999] animate-fade-in-up max-h-80 overflow-y-auto">
              <p className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Translate Page</p>
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => triggerTranslate(lang.code)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-all hover:bg-gray-50 ${
                    currentLang === lang.code ? 'bg-primary-50 text-primary-700 font-bold' : 'text-gray-700'
                  }`}
                >
                  <span className="text-base">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                  {currentLang === lang.code && (
                    <span className="ml-auto text-[9px] font-bold text-primary-500 bg-primary-100 px-1.5 py-0.5 rounded">ACTIVE</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-50">
          <Bell className="w-5 h-5" />
        </button>
        <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 md:hidden">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Desktop Sidebar
const Sidebar = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = profile?.role === 'doctor' 
    ? [
        { name: 'Dashboard', icon: HomeIcon, path: '/home' },
        { name: 'Manage Patients', icon: CalendarIcon, path: '/doctor-manage' },
        { name: 'My Profile', icon: UserIcon, path: '/profile' }
      ]
    : profile?.role === 'hospital'
    ? [
        { name: 'Dashboard', icon: HomeIcon, path: '/home' },
        { name: 'Room Allocation', icon: Activity, path: '/room-allocation' },
        { name: 'Hospital Mngmt', icon: Building, path: '/hospital-manage' },
        { name: 'My Profile', icon: UserIcon, path: '/profile' }
      ]
    : profile?.role === 'driver'
    ? [
        { name: 'Dashboard', icon: HomeIcon, path: '/driver-dashboard' },
        { name: 'My Profile', icon: UserIcon, path: '/profile' }
      ]
    : [
        { name: 'Dashboard', icon: HomeIcon, path: '/home' },
        { name: 'ICU Beds', icon: Activity, path: '/icu-beds' },
        { name: 'Doctor Appointment', icon: CalendarIcon, path: '/bookings' },
        { name: 'Medical Records', icon: History, path: '/records' },
        { name: 'My Profile', icon: UserIcon, path: '/profile' },
      ];

  return (
    <div className="hidden md:flex w-60 bg-white border-r border-gray-100 flex-col shrink-0">
      <div className="p-6 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <img src="/carepluslogo.jpeg" alt="Careplus" className="w-10 h-10 rounded-xl object-contain shadow-md" />
          <span className="font-extrabold text-lg text-gray-800 tracking-tight">Careplus</span>
        </div>
      </div>
      
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button 
              key={item.path}
              onClick={() => navigate(item.path)} 
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all text-sm font-medium
                ${active 
                  ? 'bg-primary-50 text-primary-700 font-bold shadow-sm' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
            >
              <Icon className={`w-5 h-5 mr-3 ${active ? 'text-primary-600' : ''}`} />
              {item.name}
            </button>
          );
        })}
        
        {profile?.role === 'patient' && (
          <button 
            onClick={() => navigate('/emergency')} 
            className="w-full flex items-center px-4 py-3 text-red-500 rounded-xl hover:bg-red-50 transition-all text-sm font-bold mt-6 border border-red-100"
          >
            <PlusSquare className="w-5 h-5 mr-3" /> Book Ambulance
          </button>
        )}
      </nav>

      {/* User Info + Logout */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{profile?.full_name || 'User'}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
          </div>
        </div>
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center px-4 py-2.5 text-red-500 rounded-xl hover:bg-red-50 transition-all text-sm font-medium border border-red-100"
        >
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </button>
      </div>
    </div>
  );
};

// Mobile Bottom Navigation
const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const tabs = profile?.role === 'doctor'
    ? [
        { name: 'Home', icon: HomeIcon, path: '/home' },
        { name: 'Manage', icon: CalendarIcon, path: '/doctor-manage' },
        { name: 'Profile', icon: UserIcon, path: '/profile' }
      ]
    : profile?.role === 'hospital'
    ? [
        { name: 'Home', icon: HomeIcon, path: '/home' },
        { name: 'Rooms', icon: Activity, path: '/room-allocation' },
        { name: 'Profile', icon: UserIcon, path: '/profile' }
      ]
    : profile?.role === 'driver'
    ? [
        { name: 'Dashboard', icon: HomeIcon, path: '/driver-dashboard' },
        { name: 'Profile', icon: UserIcon, path: '/profile' }
      ]
    : [
        { name: 'Ambulance', icon: PlusSquare, path: '/emergency', isEmergency: true },
        { name: 'ICU Beds', icon: Activity, path: '/icu-beds' },
        { name: 'Home', icon: HomeIcon, path: '/home' },
        { name: 'Dr. Appointment', icon: CalendarIcon, path: '/bookings' },
        { name: 'Profile', icon: UserIcon, path: '/profile' }
      ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-4 py-2 pb-safe z-50 md:hidden">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab, idx) => {
          const isActive = location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`);
          const Icon = tab.icon;
          
          return (
            <button 
              key={idx} 
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all
                ${tab.isEmergency 
                  ? 'text-red-500' 
                  : isActive 
                    ? 'text-primary-600' 
                    : 'text-gray-400'}`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive && !tab.isEmergency ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              <span className={`text-[10px] ${isActive || tab.isEmergency ? 'font-bold' : 'font-medium'}`}>{tab.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Main App
function App() {
  const { user, profile, loading } = useAuth();

  // Show a centered spinner only during initial auth check
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <img src="/carepluslogo.jpeg" alt="Careplus" className="w-16 h-16 rounded-2xl object-contain shadow-lg mb-4 animate-pulse" />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mt-2"></div>
        <p className="text-gray-400 text-sm mt-4 font-medium">Loading Careplus...</p>
      </div>
    );
  }

  const getRedirectPath = () => {
    if (profile?.role === 'driver') return '/driver-dashboard';
    return '/home';
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex w-full">
        {/* Desktop Sidebar */}
        {user && <Sidebar />}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-screen relative">
          {user && <TopBar />}
          
          <main className="flex-1 w-full overflow-y-auto pb-20 md:pb-6">
            <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>}>
            <Routes>
              <Route path="/" element={!user ? <LandingPage /> : <Navigate to={getRedirectPath()} />} />
              <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to={getRedirectPath()} />} />
              
              <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/bookings/*" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
              <Route path="/records" element={<ProtectedRoute><Records /></ProtectedRoute>} />
              <Route path="/symptom-checker" element={<ProtectedRoute><SymptomChecker /></ProtectedRoute>} />
              <Route path="/emergency" element={<ProtectedRoute><EmergencyTracker /></ProtectedRoute>} />
              <Route path="/icu-beds" element={<ProtectedRoute><IcuBeds /></ProtectedRoute>} />
              <Route path="/hospital/:id" element={<ProtectedRoute><HospitalDetail /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/room-allocation" element={<ProtectedRoute roleRequired="hospital"><RoomAllocation /></ProtectedRoute>} />
              <Route path="/doctor-manage" element={<ProtectedRoute roleRequired="doctor"><DoctorDashboard /></ProtectedRoute>} />
              <Route path="/hospital-manage" element={<ProtectedRoute roleRequired="hospital"><HospitalDashboard /></ProtectedRoute>} />
              <Route path="/driver-dashboard" element={<ProtectedRoute roleRequired="driver"><DriverDashboard /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            </Suspense>
          </main>
          
          {user && <BottomNav />}
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
