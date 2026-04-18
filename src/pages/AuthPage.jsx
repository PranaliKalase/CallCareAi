import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import {
  User, Stethoscope, Building2, Mail, Lock, Eye, EyeOff,
  ArrowRight, ArrowLeft, Upload, FileCheck, AlertCircle,
  CheckCircle2, Shield, Heart, Loader2, Truck
} from 'lucide-react';

const ROLES = [
  {
    id: 'patient',
    label: 'Patient',
    icon: Heart,
    description: 'Book appointments & manage health',
    gradient: 'from-rose-500 to-pink-600',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-200',
    hoverBorder: 'hover:border-rose-300',
    shadow: 'shadow-rose-100',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    description: 'Manage patients & consultations',
    gradient: 'from-blue-500 to-indigo-600',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
    hoverBorder: 'hover:border-blue-300',
    shadow: 'shadow-blue-100',
  },
  {
    id: 'hospital',
    label: 'Hospital',
    icon: Building2,
    description: 'Admin dashboard & doctor management',
    gradient: 'from-emerald-500 to-teal-600',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-300',
    shadow: 'shadow-emerald-100',
  },
  {
    id: 'driver',
    label: 'Ambulance',
    icon: Truck,
    description: 'Accept emergency requests',
    gradient: 'from-orange-500 to-amber-600',
    bgLight: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
    hoverBorder: 'hover:border-orange-300',
    shadow: 'shadow-orange-100',
  },
];

export default function AuthPage() {
  const { signIn, signUp } = useAuth();

  // UI state
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(0); // 0 = role select, 1 = form
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [proofFile, setProofFile] = useState(null);

  // Additional Hospital-specific fields (at signup)
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');

  // Additional Driver-specific fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverType, setDriverType] = useState('Emergency');

  // Hospital list
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch hospitals when doctor role is selected in signup
  useEffect(() => {
    if (selectedRole === 'doctor' && !isLogin) {
      fetchHospitals();
    }
  }, [selectedRole, isLogin]);

  const fetchHospitals = async () => {
    setLoadingHospitals(true);
    try {
      const { data, error } = await supabase
        .from('hospital_admins')
        .select('id, full_name, city, state')
        .order('full_name');
      if (!error && data) {
        setHospitals(data);
      }
    } catch (err) {
      console.error('Error fetching hospitals:', err);
    } finally {
      setLoadingHospitals(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setLicenseNumber('');
    setSpecialization('');
    setHospitalId('');
    setProofFile(null);
    setAddress('');
    setCity('');
    setState('');
    setPhone('');
    setVehicleNumber('');
    setDriverType('Emergency');
    setError('');
    setSuccess('');
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setStep(0);
    setSelectedRole(null);
    resetForm();
  };

  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
    setError('');
    setTimeout(() => setStep(1), 300);
  };

  const handleBack = () => {
    setStep(0);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10 MB');
        return;
      }
      setProofFile(file);
      setError('');
    }
  };

  const validate = () => {
    if (!email.trim()) return 'Email is required';
    if (!/\S+@\S+\.\S+/.test(email)) return 'Please enter a valid email';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';

    if (!isLogin) {
      if (!fullName.trim()) return 'Full name is required';
      if (password !== confirmPassword) return 'Passwords do not match';

      if (selectedRole === 'doctor') {
        if (!licenseNumber.trim()) return 'License number is required';
        if (!hospitalId) return 'Please select a hospital';
      }
      
      if (selectedRole === 'hospital') {
        if (!address.trim()) return 'Address is required';
        if (!city.trim()) return 'City is required';
        if (!phone.trim()) return 'Phone number is required';
      }

      if (selectedRole === 'driver') {
        if (!phone.trim()) return 'Phone number is required';
        if (!vehicleNumber.trim()) return 'Ambulance vehicle number is required';
        if (!licenseNumber.trim()) return 'License number is required';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        const selectedHospital = hospitals.find(h => h.id === hospitalId);
        const hospitalName = selectedHospital?.full_name || '';

        await signUp(
          email,
          password,
          fullName,
          selectedRole,
          specialization || undefined,
          hospitalName || undefined,
          licenseNumber || undefined,
          proofFile || undefined,
          address || undefined,
          city || undefined,
          state || undefined,
          phone || undefined,
          hospitalId || undefined,
          vehicleNumber || undefined,
          driverType || undefined
        );
      }
    } catch (err) {
      const msg = err?.message || 'Something went wrong';
      if (msg.includes('pending approval') || msg.includes('Registration successful')) {
        setSuccess(msg);
        resetForm();
        setStep(0);
        setSelectedRole(null);
        setIsLogin(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentRoleConfig = ROLES.find(r => r.id === selectedRole);

  // Input class helper
  const inputClass = "w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition-all text-sm shadow-sm";
  const inputClassWithToggle = "w-full pl-11 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400 transition-all text-sm shadow-sm";
  const labelClass = "block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-gray-50 via-primary-50/30 to-blue-50/40">
      {/* Decorative background shapes */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary-200/30 blur-[100px]" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-200/25 blur-[100px]" />
      <div className="absolute top-[30%] left-[10%] w-[300px] h-[300px] rounded-full bg-rose-100/20 blur-[80px]" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <img src="/carepluslogo.jpeg" alt="Careplus" className="w-20 h-20 mx-auto rounded-2xl object-contain shadow-xl shadow-primary-500/10 mb-4" />
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
            Careplus
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
            {isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
          </p>
        </div>

        {/* Glass Card */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-gray-200/60 shadow-xl shadow-gray-200/40 overflow-hidden">
          {/* Step indicator — only on signup */}
          {!isLogin && (
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 0 ? 'bg-primary-500' : 'bg-gray-200'}`} />
                <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
              </div>
              <p className="text-xs text-gray-400 mt-2 font-medium">
                {step === 0 ? 'Step 1: Choose your role' : `Step 2: ${currentRoleConfig?.label || ''} details`}
              </p>
            </div>
          )}

          <div className="p-6">
            {/* ─── LOGIN FORM ─── */}
            {isLogin && (
              <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in-up" id="login-form">
                <h2 className="text-xl font-bold text-gray-800 mb-1">Sign In</h2>

                {/* Email */}
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClassWithToggle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 text-white font-bold text-sm shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 hover:from-primary-400 hover:to-primary-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ─── SIGNUP — STEP 0: Role Selection ─── */}
            {!isLogin && step === 0 && (
              <div className="space-y-4 animate-fade-in-up" id="role-selection">
                <h2 className="text-xl font-bold text-gray-800 mb-1">I am a...</h2>
                <div className="space-y-3">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    const isSelected = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        id={`role-btn-${role.id}`}
                        type="button"
                        onClick={() => handleRoleSelect(role.id)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 group
                          ${isSelected
                            ? `${role.borderColor} ${role.bgLight} scale-[1.02] shadow-md ${role.shadow}`
                            : `border-gray-100 bg-white hover:bg-gray-50 ${role.hoverBorder} hover:shadow-md`
                          }`}
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${isSelected ? 'scale-110' : ''}`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-gray-800 font-bold text-sm">{role.label}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{role.description}</p>
                        </div>
                        <ArrowRight className={`w-4 h-4 text-gray-300 transition-all group-hover:text-gray-500 group-hover:translate-x-1 ${isSelected ? `${role.textColor} translate-x-1` : ''}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── SIGNUP — STEP 1: Details Form ─── */}
            {!isLogin && step === 1 && (
              <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in-up" id="signup-form">
                {/* Back Button & Title */}
                <div className="flex items-center gap-3 mb-1">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="p-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-all"
                    id="signup-back-btn"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      {currentRoleConfig?.label} Registration
                    </h2>
                  </div>
                </div>

                {/* Role badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${currentRoleConfig?.gradient} text-white text-xs font-bold shadow-sm`}>
                  {currentRoleConfig && <currentRoleConfig.icon className="w-3 h-3" />}
                  {currentRoleConfig?.label}
                </div>

                {/* Full Name */}
                <div>
                  <label className={labelClass}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={selectedRole === 'hospital' ? 'Hospital name' : 'Your full name'}
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className={labelClass}>Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className={inputClassWithToggle}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="signup-confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className={inputClassWithToggle}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* ── Doctor-Only Fields ── */}
                {selectedRole === 'doctor' && (
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5" /> Doctor Verification
                    </p>

                    {/* License Number */}
                    <div>
                      <label className={labelClass}>License Number</label>
                      <input
                        id="signup-license"
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="Medical license number"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>

                    {/* Specialization */}
                    <div>
                      <label className={labelClass}>Specialization</label>
                      <input
                        id="signup-specialization"
                        type="text"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        placeholder="e.g. Cardiologist, Neurologist"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all text-sm shadow-sm"
                      />
                    </div>

                    {/* Hospital Dropdown */}
                    <div>
                      <label className={labelClass}>Select Hospital</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          id="signup-hospital"
                          value={hospitalId}
                          onChange={(e) => setHospitalId(e.target.value)}
                          className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all text-sm appearance-none cursor-pointer shadow-sm"
                          required
                        >
                          <option value="" className="text-gray-400">
                            {loadingHospitals ? 'Loading hospitals...' : '— Select a hospital —'}
                          </option>
                          {hospitals.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.full_name}{h.city ? ` — ${h.city}` : ''}{h.state ? `, ${h.state}` : ''}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {hospitals.length === 0 && !loadingHospitals && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          No hospitals registered yet
                        </p>
                      )}
                    </div>

                    {/* Certificate Upload */}
                    <div>
                      <label className={labelClass}>Upload Certificate</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                        className="hidden"
                        id="signup-certificate-input"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all text-sm
                          ${proofFile
                            ? 'border-green-300 bg-green-50 text-green-700'
                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
                          }`}
                        id="signup-certificate-btn"
                      >
                        {proofFile ? (
                          <>
                            <FileCheck className="w-5 h-5 text-green-500 shrink-0" />
                            <div className="text-left flex-1 min-w-0">
                              <p className="font-medium truncate text-green-700">{proofFile.name}</p>
                              <p className="text-xs text-green-500 mt-0.5">{(proofFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 shrink-0" />
                            <div className="text-left flex-1">
                              <p className="font-medium text-gray-600">Upload medical certificate</p>
                              <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG — Max 10 MB</p>
                            </div>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Hospital-Only Fields ── */}
                {selectedRole === 'hospital' && (
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Hospital Information
                    </p>

                    {/* Address */}
                    <div>
                      <label className={labelClass}>Hospital Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street address"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* City */}
                      <div>
                        <label className={labelClass}>City</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all text-sm shadow-sm"
                          required
                        />
                      </div>
                      {/* State */}
                      <div>
                        <label className={labelClass}>State / Region</label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="State"
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all text-sm shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label className={labelClass}>Contact Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone line"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* ── Driver-Only Fields ── */}
                {selectedRole === 'driver' && (
                  <div className="space-y-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-orange-600 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Ambulance Details
                    </p>

                    <div>
                      <label className={labelClass}>Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 9000000000"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Vehicle Number</label>
                      <input
                        type="text"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        placeholder="e.g. MH 01 AB 1234"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Driving License ID</label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="License Number"
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all text-sm shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Ambulance Type</label>
                      <div className="relative">
                        <select
                          value={driverType}
                          onChange={(e) => setDriverType(e.target.value)}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 transition-all text-sm appearance-none shadow-sm cursor-pointer"
                        >
                          <option value="Emergency">Standard Emergency</option>
                          <option value="Basic">BLS (Basic Life Support)</option>
                          <option value="ICU">ALS / ICU (Advanced Life Support)</option>
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  id="signup-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3.5 rounded-xl bg-gradient-to-r ${currentRoleConfig?.gradient || 'from-primary-500 to-primary-700'} text-white font-bold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Create {currentRoleConfig?.label} Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Error / Success Messages */}
            {error && (
              <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 animate-fade-in-up" id="auth-error">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-red-700 text-sm leading-relaxed">{error}</p>
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-xl bg-green-50 border border-green-200 animate-fade-in-up" id="auth-success">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <p className="text-green-700 text-sm leading-relaxed">{success}</p>
              </div>
            )}
          </div>

          {/* Footer Toggle */}
          <div className="px-6 pb-6">
            <div className="border-t border-gray-100 pt-5">
              <p className="text-center text-sm text-gray-500">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="ml-1.5 text-primary-600 font-bold hover:text-primary-700 transition-colors"
                  id="toggle-auth-mode"
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-6 animate-fade-in-up">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>256-bit Encryption</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>HIPAA Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
