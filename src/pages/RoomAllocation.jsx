import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Activity, BedDouble, ChevronDown, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

// Define the exact sections the user asked for
const SECTIONS = ['ICU', 'General Ward', 'Emergency'];

const RoomAllocation = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState(SECTIONS[0]);
  
  // Storing beds state by section
  const [bedsData, setBedsData] = useState({
    'ICU': [],
    'General Ward': [],
    'Emergency': []
  });

  const [loading, setLoading] = useState(true);
  const [savingSync, setSavingSync] = useState(false);

  // Initialize Data
  useEffect(() => {
    if (!user) return;
    
    // Check local storage for persistent testing data to honor manual toggles
    const stored = localStorage.getItem(`careplus_beds_${user.id}`);
    if (stored) {
      setBedsData(JSON.parse(stored));
      setLoading(false);
    } else {
      // Mock deterministic structure
      const generateWards = (count, prefix) => {
        return Array.from({ length: count }).map((_, i) => ({
          id: `${prefix}-bed-${i}`,
          name: `BED ${i + 1}`,
          // randomize default availability just to have some red
          isAvailable: i < count / 2 
        }));
      };

      const newBedsData = {
        'ICU': [...generateWards(15, 'icu-ward-a'), ...generateWards(10, 'icu-ward-b')],
        'General Ward': generateWards(40, 'gen'),
        'Emergency': generateWards(8, 'er')
      };
      
      setBedsData(newBedsData);
      setLoading(false);
    }
  }, [user]);

  // Sync to database 'available_icu_beds' when ICU beds change specifically
  useEffect(() => {
    if (loading || !user) return;
    
    localStorage.setItem(`careplus_beds_${user.id}`, JSON.stringify(bedsData));
    
    const syncDb = async () => {
      setSavingSync(true);
      const openIcu = bedsData['ICU'].filter(b => b.isAvailable).length;
      await supabase.from('hospital_admins').update({ available_icu_beds: openIcu }).eq('id', user.id);
      setSavingSync(false);
    };

    const debounce = setTimeout(syncDb, 1000);
    return () => clearTimeout(debounce);
  }, [bedsData, user, loading]);

  const toggleBedAvailable = (targetId) => {
    setBedsData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(b => b.id === targetId ? { ...b, isAvailable: true } : b)
    }));
  };

  const toggleBedUnavailable = (targetId) => {
    setBedsData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(b => b.id === targetId ? { ...b, isAvailable: false } : b)
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  const currentBeds = bedsData[activeTab];
  const availableBedsCount = currentBeds.filter(b => b.isAvailable).length;
  const totalBedsCount = currentBeds.length;

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <Activity className="text-indigo-700 w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Hospital Admin</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Room Allocation</h1>
          </div>
        </div>
        <p className="text-gray-500 font-medium ml-16">Manage your live bed states across all wards.</p>
      </div>

      <div className="max-w-4xl mx-auto mb-6">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          
          {/* Dropdown / Tabs Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="relative inline-block w-full sm:w-64">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 font-extrabold text-lg rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
              >
                {SECTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              {savingSync && <span className="text-indigo-500 animate-pulse lowercase font-medium">Syncing...</span>}
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Available</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Occupied</div>
            </div>
          </div>

          {/* Grid Container */}
          <div className="bg-white rounded-3xl border border-gray-50">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-gray-900 text-xl">{activeTab} Layout</h3>
                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                  {availableBedsCount} OF {totalBedsCount} BEDS OPEN
                </p>
              </div>
              {availableBedsCount > 0 ? (
                <span className="bg-green-50 text-green-600 border border-green-100 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">Accepting</span>
              ) : (
                <span className="bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">Full</span>
              )}
            </div>

            <p className="text-xs text-gray-400 font-medium mb-4 italic">
              * Single click to mark available, Double click to mark occupied.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {currentBeds.map(bed => {
                return (
                  <div
                    key={bed.id}
                    onClick={() => toggleBedAvailable(bed.id)}         // Single click -> Green
                    onDoubleClick={() => toggleBedUnavailable(bed.id)} // Double click -> Red
                    className={`relative p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border cursor-pointer select-none
                      ${bed.isAvailable 
                        ? 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700' 
                        : 'bg-red-50 border-red-200 hover:bg-red-100 text-red-600 shadow-sm shadow-red-500/10'
                      }
                    `}
                  >
                    <BedDouble className={`w-7 h-7 ${bed.isAvailable ? 'text-green-500' : 'text-red-400'}`} />
                    
                    <span className={`text-[11px] font-bold uppercase tracking-widest ${bed.isAvailable ? 'text-green-700' : 'text-red-700'}`}>
                      {bed.name}
                    </span>

                    {/* Indicator Dot */}
                    <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${bed.isAvailable ? 'bg-green-500' : 'bg-red-400'}`}></div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RoomAllocation;
