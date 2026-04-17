import React, { useState, useEffect } from 'react';
import {
  Brain, Activity, Heart, Thermometer, Search, X, ChevronRight,
  AlertTriangle, Shield, Stethoscope, Zap, Clock, ArrowLeft,
  Loader2, Sparkles, Eye, Wind, Droplets, Bone,
  CheckCircle2, Info, ChevronDown, ChevronUp, BookOpen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const GEMINI_API_KEY = 'AIzaSyAMG9X5ykRGI-F3YK0UicmvXpb4zfVAA6I';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Symptom categories with common symptoms ──
const SYMPTOM_CATEGORIES = [
  {
    name: 'General',
    icon: Activity,
    color: 'blue',
    symptoms: ['Fever', 'Fatigue', 'Weight Loss', 'Weight Gain', 'Chills', 'Night Sweats', 'Loss of Appetite', 'Weakness', 'Dizziness', 'Fainting']
  },
  {
    name: 'Head & Neuro',
    icon: Brain,
    color: 'purple',
    symptoms: ['Headache', 'Migraine', 'Memory Loss', 'Confusion', 'Seizures', 'Numbness', 'Tingling', 'Tremors', 'Blurred Vision', 'Difficulty Speaking']
  },
  {
    name: 'Chest & Heart',
    icon: Heart,
    color: 'red',
    symptoms: ['Chest Pain', 'Palpitations', 'Shortness of Breath', 'Rapid Heartbeat', 'Swelling in Legs', 'Cough with Blood', 'Irregular Heartbeat']
  },
  {
    name: 'Respiratory',
    icon: Wind,
    color: 'cyan',
    symptoms: ['Cough', 'Wheezing', 'Difficulty Breathing', 'Sore Throat', 'Nasal Congestion', 'Sneezing', 'Runny Nose', 'Chest Tightness']
  },
  {
    name: 'Digestive',
    icon: Droplets,
    color: 'amber',
    symptoms: ['Nausea', 'Vomiting', 'Diarrhea', 'Constipation', 'Abdominal Pain', 'Bloating', 'Heartburn', 'Blood in Stool', 'Difficulty Swallowing']
  },
  {
    name: 'Skin & Eyes',
    icon: Eye,
    color: 'green',
    symptoms: ['Rash', 'Itching', 'Skin Discoloration', 'Dry Skin', 'Bruising', 'Hair Loss', 'Red Eyes', 'Eye Pain', 'Jaundice', 'Swelling']
  },
  {
    name: 'Musculoskeletal',
    icon: Bone,
    color: 'orange',
    symptoms: ['Joint Pain', 'Back Pain', 'Muscle Pain', 'Stiffness', 'Swollen Joints', 'Muscle Weakness', 'Cramps', 'Neck Pain', 'Limited Mobility']
  },
];

const colorMap = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200', border: 'border-blue-200', activeBg: 'bg-blue-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-200', border: 'border-purple-200', activeBg: 'bg-purple-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-200', border: 'border-red-200', activeBg: 'bg-red-100' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', ring: 'ring-cyan-200', border: 'border-cyan-200', activeBg: 'bg-cyan-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200', border: 'border-amber-200', activeBg: 'bg-amber-100' },
  green: { bg: 'bg-green-50', text: 'text-green-600', ring: 'ring-green-200', border: 'border-green-200', activeBg: 'bg-green-100' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-200', border: 'border-orange-200', activeBg: 'bg-orange-100' },
};

const SymptomChecker = () => {
  const navigate = useNavigate();
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [duration, setDuration] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedCondition, setExpandedCondition] = useState(null);
  const [step, setStep] = useState(1); // 1 = select symptoms, 2 = results

  const { profile } = useAuth();
  const [patientReports, setPatientReports] = useState([]);
  const [selectedReports, setSelectedReports] = useState([]);

  useEffect(() => {
    if (profile?.id) {
      fetchReports();
    }
  }, [profile]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('patient_reports')
        .select('*')
        .eq('patient_id', profile.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setPatientReports(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const toggleReport = (report) => {
    setSelectedReports(prev =>
      prev.includes(report) ? prev.filter(r => r !== report) : [...prev, report]
    );
  };

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  };

  const addCustomSymptom = () => {
    const trimmed = customSymptom.trim();
    if (trimmed && !selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms(prev => [...prev, trimmed]);
      setCustomSymptom('');
    }
  };

  const analyzeSymptoms = async () => {
    if (selectedSymptoms.length < 2) {
      alert('Please select at least 2 symptoms for accurate analysis.');
      return;
    }
    setAnalyzing(true);
    setResult(null);

    const prompt = `You are an advanced medical AI assistant specialized in early disease prediction. Analyze the following patient symptoms and provide a structured prediction.

PATIENT INFO:
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}  
- Symptom Duration: ${duration || 'Not specified'}
- Symptoms: ${selectedSymptoms.join(', ')}

${selectedReports.length > 0 ? `PREVIOUS MEDICAL REPORTS CONTEXT (Consider this history if relevant to current symptoms):
${selectedReports.map(r => `- ${r.record_type} Analysis: ${r.analysis_result || 'No details'}`).join('\n')}` : ''}

Respond ONLY with valid JSON in this exact format (no markdown, no code fences, just pure JSON):
{
  "predictions": [
    {
      "condition": "Disease/Condition Name",
      "probability": "High/Medium/Low",
      "description": "2-3 sentence description of the condition",
      "matching_symptoms": ["symptom1", "symptom2"],
      "additional_symptoms_to_watch": ["symptom that could confirm"],
      "recommended_specialist": "Type of doctor",
      "urgency": "Immediate/Soon/Routine",
      "early_actions": ["action1", "action2"]
    }
  ],
  "general_advice": "Brief general health advice based on the symptoms",
  "red_flags": ["any dangerous symptom combinations to watch out for"],
  "lifestyle_tips": ["tip1", "tip2", "tip3"]
}

Provide 3-5 possible conditions ranked by probability. Be thorough but remember this is for early detection guidance, not diagnosis.`;

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        let errMsg = `API error: ${response.status}`;
        try {
          const errData = await response.json();
          errMsg = `API error ${response.status}: ${JSON.stringify(errData)}`;
        } catch(e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error('No response from AI');

      // Clean markdown fences if present
      text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();

      const parsed = JSON.parse(text);
      setResult(parsed);
      setStep(2);
    } catch (err) {
      console.error('Analysis error:', err);
      alert('Analysis failed. Please try again. ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const urgencyColor = (urgency) => {
    if (urgency === 'Immediate') return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' };
    if (urgency === 'Soon') return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' };
    return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' };
  };

  const probColor = (prob) => {
    if (prob === 'High') return 'bg-red-500';
    if (prob === 'Medium') return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const resetAll = () => {
    setSelectedSymptoms([]);
    setCustomSymptom('');
    setAge('');
    setGender('');
    setDuration('');
    setSelectedReports([]);
    setResult(null);
    setStep(1);
    setExpandedCondition(null);
  };

  // ══════════════════════════════════════════
  //  RESULTS VIEW
  // ══════════════════════════════════════════
  if (step === 2 && result) {
    return (
      <div className="flex flex-col min-h-screen pb-24 md:pb-6 bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setStep(1)} className="flex items-center text-sm text-primary-700 font-semibold mb-3 hover:text-primary-800 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Symptoms
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">AI Prediction Results</h1>
                <p className="text-xs text-gray-400">Based on {selectedSymptoms.length} symptoms analyzed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 space-y-4">

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700">Medical Disclaimer</p>
              <p className="text-[11px] text-amber-600/80 mt-0.5">This is an AI-assisted prediction for early awareness only. It is <b>not a medical diagnosis</b>. Always consult a qualified doctor for proper evaluation.</p>
            </div>
          </div>

          {/* Red Flags */}
          {result.red_flags && result.red_flags.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <h3 className="text-xs font-extrabold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Red Flags to Watch
              </h3>
              <ul className="space-y-1.5">
                {result.red_flags.map((flag, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Predictions */}
          <div>
            <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> Possible Conditions
            </h3>
            <div className="space-y-3">
              {(result.predictions || []).map((pred, idx) => {
                const uc = urgencyColor(pred.urgency);
                const isExpanded = expandedCondition === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-primary-200 transition-all cursor-pointer"
                    onClick={() => setExpandedCondition(isExpanded ? null : idx)}
                  >
                    {/* Card Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${uc.bg}`}>
                              <Stethoscope className={`w-5 h-5 ${uc.text}`} />
                            </div>
                            <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[8px] font-black flex items-center justify-center ${probColor(pred.probability)}`}>
                              {idx + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-gray-900 text-sm leading-tight">{pred.condition}</h4>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${uc.bg} ${uc.text} ${uc.border}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${uc.dot} mr-1`} />
                                {pred.urgency}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${probColor(pred.probability)}`}>
                                {pred.probability} Probability
                              </span>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-50 space-y-3 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <p className="text-xs text-gray-600 leading-relaxed">{pred.description}</p>

                        {/* Matching Symptoms */}
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Matching Symptoms</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(pred.matching_symptoms || []).map((s, i) => (
                              <span key={i} className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-bold rounded-full">{s}</span>
                            ))}
                          </div>
                        </div>

                        {/* Watch For */}
                        {pred.additional_symptoms_to_watch?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Also Watch For</p>
                            <div className="flex flex-wrap gap-1.5">
                              {pred.additional_symptoms_to_watch.map((s, i) => (
                                <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full border border-amber-100">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Early Actions */}
                        {pred.early_actions?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Recommended Actions</p>
                            <div className="space-y-1">
                              {pred.early_actions.map((a, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                  {a}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Specialist */}
                        <div className="bg-primary-50 rounded-xl p-3 flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-primary-600" />
                          <span className="text-xs font-bold text-primary-700">
                            Recommended: {pred.recommended_specialist}
                          </span>
                          <button
                            onClick={() => navigate('/bookings')}
                            className="ml-auto px-3 py-1 bg-primary-600 text-white rounded-lg text-[10px] font-bold hover:bg-primary-700 transition-all"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* General Advice */}
          {result.general_advice && (
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <h3 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> General Advice
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">{result.general_advice}</p>
            </div>
          )}

          {/* Lifestyle Tips */}
          {result.lifestyle_tips?.length > 0 && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
              <h3 className="text-xs font-extrabold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Lifestyle Tips
              </h3>
              <div className="space-y-1.5">
                {result.lifestyle_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-green-700">
                    <Zap className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-8">
            <button onClick={resetAll}
              className="flex-1 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all active:scale-[0.98]">
              Check New Symptoms
            </button>
            <button onClick={() => navigate('/bookings')}
              className="flex-1 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-[0.98]">
              Book Appointment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  //  SYMPTOM SELECTION VIEW
  // ══════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-screen pb-24 md:pb-6 bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">AI Disease Prediction</h1>
              <p className="text-xs text-gray-400 font-medium">Early detection through symptom analysis</p>
            </div>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            <div className={`h-1.5 rounded-full flex-1 transition-all ${selectedSymptoms.length >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            <div className={`h-1.5 rounded-full flex-1 transition-all ${selectedSymptoms.length >= 3 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            <div className={`h-1.5 rounded-full flex-1 transition-all ${age && gender ? 'bg-primary-500' : 'bg-gray-200'}`} />
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 space-y-5">

        {/* Selected Symptoms Bar */}
        {selectedSymptoms.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-fade-in-up">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Symptoms ({selectedSymptoms.length})</p>
              <button onClick={() => setSelectedSymptoms([])} className="text-[10px] font-bold text-red-500 hover:text-red-600">Clear All</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedSymptoms.map(s => (
                <span key={s} className="px-2.5 py-1 bg-primary-50 text-primary-700 text-[11px] font-bold rounded-full flex items-center gap-1">
                  {s}
                  <button onClick={() => toggleSymptom(s)} className="hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Patient Info */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Patient Details (Optional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              placeholder="Age"
              value={age}
              onChange={e => setAge(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
            />
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium appearance-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-gray-500"
            >
              <option value="">Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-medium appearance-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-gray-500"
            >
              <option value="">Duration</option>
              <option value="Today">Today</option>
              <option value="2-3 days">2-3 days</option>
              <option value="1 week">~1 week</option>
              <option value="2+ weeks">2+ weeks</option>
              <option value="1+ month">1+ month</option>
            </select>
          </div>
        </div>

        {/* Previous Reports Inclusion */}
        {patientReports.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Include Medical History</p>
            <div className="space-y-2">
              {patientReports.map(report => {
                const isSelected = selectedReports.includes(report);
                return (
                  <button
                    key={report.id}
                    onClick={() => toggleReport(report)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left
                      ${isSelected ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0
                        ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300 bg-white'}`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${isSelected ? 'text-primary-800' : 'text-gray-700'}`}>
                          {report.record_type} Analysis
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">{new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[9px] text-gray-400 mt-2 italic">* Optional: AI will use these to understand your baseline health.</p>
          </div>
        )}

        {/* Add Custom Symptom */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Type a symptom not listed below..."
            value={customSymptom}
            onChange={e => setCustomSymptom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomSymptom()}
            className="w-full pl-10 pr-20 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
          {customSymptom.trim() && (
            <button
              onClick={addCustomSymptom}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-[10px] font-bold hover:bg-primary-700 transition-all"
            >
              + Add
            </button>
          )}
        </div>

        {/* Symptom Categories */}
        <div className="space-y-3 pb-4">
          {SYMPTOM_CATEGORIES.map((cat) => {
            const cm = colorMap[cat.color];
            const Icon = cat.icon;
            const isExpanded = expandedCategory === cat.name;
            const selectedInCat = cat.symptoms.filter(s => selectedSymptoms.includes(s)).length;

            return (
              <div key={cat.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cm.bg}`}>
                      <Icon className={`w-4 h-4 ${cm.text}`} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-gray-900">{cat.name}</span>
                      <p className="text-[10px] text-gray-400">{cat.symptoms.length} symptoms</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedInCat > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cm.bg} ${cm.text}`}>
                        {selectedInCat} selected
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-50 animate-fade-in-up">
                    <div className="flex flex-wrap gap-2 mt-3">
                      {cat.symptoms.map(s => {
                        const isSelected = selectedSymptoms.includes(s);
                        return (
                          <button
                            key={s}
                            onClick={() => toggleSymptom(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95
                              ${isSelected
                                ? `${cm.activeBg} ${cm.text} ${cm.border} ring-1 ${cm.ring}`
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                              }`}
                          >
                            {isSelected && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Analyze Button */}
        <div className="sticky bottom-20 md:bottom-4 z-40 pb-2">
          <button
            onClick={analyzeSymptoms}
            disabled={analyzing || selectedSymptoms.length < 2}
            className={`w-full py-4 rounded-2xl font-extrabold text-base shadow-xl transition-all flex items-center justify-center gap-2
              ${selectedSymptoms.length >= 2 && !analyzing
                ? 'bg-gray-900 text-white hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing {selectedSymptoms.length} symptoms with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Predict Conditions ({selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? 's' : ''})
              </>
            )}
          </button>
          {selectedSymptoms.length < 2 && (
            <p className="text-center text-[10px] text-gray-400 mt-2">Select at least 2 symptoms to begin analysis</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymptomChecker;
