import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Shield, Clock, Mic, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 space-y-16">
      <div className="space-y-6 max-w-3xl animate-fade-in-up">
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 text-primary-700 font-medium text-sm mb-4">
          <Activity className="w-4 h-4 mr-2" />
          The future of healthcare connectivity
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">
          Seamless Care,<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-400">Anytime Anywhere</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Connect with top healthcare professionals instantly. Careplus intelligently manages your appointments, consultations, and health records securely.
        </p>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => navigate('/auth')}
            className="w-full sm:w-auto px-8 py-4 bg-primary-700 hover:bg-primary-800 text-white rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
          >
            Get Started <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mt-16">
        {[
          { icon: <Clock className="w-6 h-6 text-primary-500" />, title: "Instant Booking", desc: "Find available slots dynamically and book your appointment instantly without hassle." },
          { icon: <Mic className="w-6 h-6 text-primary-600" />, title: "Emergency Tracking", desc: "Quickly locate and book the nearest ambulances and check real-time ICU bed availability." },
          { icon: <Shield className="w-6 h-6 text-primary-700" />, title: "Secure Records", desc: "Your data is encrypted end-to-end, providing maximum privacy and compliance." }
        ].map((feature, i) => (
          <div key={i} className="card p-8 text-left hover:-translate-y-1 transition-transform duration-300 glass bg-white/60">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-6 shadow-sm border border-primary-100">
              {feature.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
            <p className="text-gray-500 leading-relaxed">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LandingPage;
