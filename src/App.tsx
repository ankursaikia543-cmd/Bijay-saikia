import React, { useState, useEffect } from 'react';
import { Bell, User, Car, Shield, Download, Volume2, Sparkles, MapPin, Phone, MessageCircle, Info, ExternalLink, ShieldCheck } from 'lucide-react';
import { AppConfig, CustomerUser, SoundConfig } from './types';
import { getAppConfig, getCurrentCustomer, getSoundConfig, saveAppConfig, setCurrentCustomer } from './services/storage';
import { initFirebaseConfigSync, pushConfigToFirebase } from './services/firebase';
import { CustomerView } from './components/CustomerView';
import { DriverView } from './components/DriverView';
import { AdminView } from './components/AdminView';
import { SoundSettingsModal } from './components/SoundSettingsModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';

export default function App() {
  const [config, setConfig] = useState<AppConfig>(getAppConfig());
  const [soundConfig, setSoundConfig] = useState<SoundConfig>(getSoundConfig());
  const [currentCustomer, setCustomer] = useState<CustomerUser | null>(getCurrentCustomer());
  const [activeTab, setActiveTab] = useState<'customer' | 'driver' | 'admin'>('customer');

  // Modals
  const [isSoundModalOpen, setIsSoundModalOpen] = useState(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

  // Admin 5-click tap unlock
  const [logoTaps, setLogoTaps] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Initialize Firebase Cloud Realtime Sync (Auto updates in APK and Web)
  useEffect(() => {
    initFirebaseConfigSync((remoteCfg) => {
      if (remoteCfg) {
        setConfig(prev => ({ ...prev, ...remoteCfg }));
      }
    });
  }, []);

  const handleUpdateConfig = (updated: AppConfig) => {
    setConfig(updated);
    saveAppConfig(updated);
    pushConfigToFirebase(updated);
  };

  const handleLogoTap = () => {
    const next = logoTaps + 1;
    setLogoTaps(next);
    if (next >= 5) {
      setAdminUnlocked(true);
      setActiveTab('admin');
      alert('🔓 Admin Mode Unlocked!');
      setLogoTaps(0);
    } else {
      setTimeout(() => setLogoTaps(0), 2000);
    }
  };

  const handleCustomerLoginSuccess = (user: CustomerUser) => {
    setCustomer(user);
    setCurrentCustomer(user);
  };

  const handleCustomerLogout = () => {
    setCustomer(null);
    setCurrentCustomer(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900">
      {/* Top Header */}
      <header className="sticky top-0 z-[1000] bg-slate-950 text-white shadow-xl border-b-2 border-yellow-400">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          {/* Logo with 5-tap unlock */}
          <div
            onClick={handleLogoTap}
            className="flex items-center gap-2 cursor-pointer select-none group"
            title="Tap 5 times to unlock Admin mode"
          >
            <div className="w-9 h-9 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-md group-hover:scale-105 transition">
              🚖
            </div>
            <div>
              <div className="text-base sm:text-lg font-black tracking-tight flex items-center gap-1.5">
                <span className="text-yellow-400">ASSAM</span>
                <span className="text-white">EASY TRIP</span>
                <span className="text-[9px] bg-yellow-400/20 text-yellow-300 font-extrabold px-1.5 py-0.2 rounded border border-yellow-400/30">
                  v33.2
                </span>
              </div>
              <p className="text-[10px] text-slate-400 -mt-0.5">Assam Easy Trip • Live Fast Rides</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Customer Login / Profile Button */}
            <button
              onClick={() => setIsCustomerAuthOpen(true)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-xs ${
                currentCustomer
                  ? 'bg-yellow-400 text-slate-950 hover:bg-yellow-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">
                {currentCustomer ? currentCustomer.name.split(' ')[0] : 'Customer Login'}
              </span>
            </button>

            {/* APK Download Button */}
            <a
              href={config.apkLink}
              target="_blank"
              rel="noreferrer"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition"
              title="Download Android APK"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">APK</span>
            </a>
          </div>
        </div>

        {/* Tab Navigation Navigation Switcher */}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pb-2.5 pt-1 flex items-center justify-between">
          <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'customer'
                  ? 'bg-yellow-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>👤 Customer</span>
            </button>

            <button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                activeTab === 'driver'
                  ? 'bg-yellow-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🚗 Driver Portal</span>
            </button>

            {adminUnlocked && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-yellow-400 text-slate-950 shadow-md'
                    : 'text-yellow-400 hover:text-yellow-300'
                }`}
              >
                <span>⚙️ Admin</span>
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-yellow-400 font-bold bg-yellow-400/10 px-2.5 py-1 rounded-lg border border-yellow-400/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Blue Dot Line + Live Route Active</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-4 pt-4">
        {activeTab === 'customer' && (
          <CustomerView
            config={config}
            currentCustomer={currentCustomer}
            onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
          />
        )}

        {activeTab === 'driver' && (
          <DriverView
            config={config}
            soundConfig={soundConfig}
            onOpenSoundSettings={() => setIsSoundModalOpen(true)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminView
            config={config}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </main>

      {/* Comprehensive Official Footer with Head Office & Contact Details */}
      <footer className="bg-slate-900 text-slate-300 text-xs pt-8 pb-10 border-t-2 border-yellow-400/30">
        <div className="max-w-4xl mx-auto px-4 space-y-6 text-center sm:text-left">
          {/* Main Brand & Head Office Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-800">
            {/* Column 1: Brand & APK Intro */}
            <div className="space-y-2 sm:col-span-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-xl">🚖</span>
                <span className="font-black text-white text-base tracking-wide">ASSAM EASY TRIP</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Assam's reliable local ride-hailing app. Fast pickup, transparent rates, continuous driver ringtones, and live GPS map tracking across Golaghat district.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => setIsApkModalOpen(true)}
                  className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-yellow-400 text-slate-950 font-black text-[11px] hover:bg-yellow-500 transition shadow-xs"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>APK Description & Details</span>
                </button>
              </div>
            </div>

            {/* Column 2: Head Office Location (User Specified) */}
            <div className="space-y-2 sm:col-span-1">
              <div className="text-xs font-black text-yellow-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                <MapPin className="w-4 h-4 text-rose-400" />
                <span>Head Office Location</span>
              </div>
              <p className="text-xs font-bold text-white leading-relaxed">
                Bokakhat, Golaghat, Assam pin 785612
              </p>
              <p className="text-[11px] text-slate-400">
                Main Road, Bokakhat Town, District: Golaghat, Assam - PIN: 785612
              </p>
            </div>

            {/* Column 3: Official Contact Numbers (User Specified) */}
            <div className="space-y-2 sm:col-span-1">
              <div className="text-xs font-black text-yellow-400 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1.5">
                <Phone className="w-4 h-4 text-emerald-400" />
                <span>Contact & Helpline Numbers</span>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <a
                    href="tel:8638803320"
                    className="font-black text-emerald-400 hover:text-emerald-300 transition inline-flex items-center gap-1"
                  >
                    <span>📞 8638803320</span>
                  </a>
                </div>
                <div>
                  <a
                    href="tel:7002754262"
                    className="font-black text-emerald-400 hover:text-emerald-300 transition inline-flex items-center gap-1"
                  >
                    <span>📞 7002754262</span>
                  </a>
                </div>
                <div className="pt-1">
                  <a
                    href="https://wa.me/918638803320"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp: 8638803320</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* APK Quick Description Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-extrabold text-white flex items-center gap-2">
                <span>📱 Official Android APK (v33.2)</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500 font-bold px-2 py-0.2 rounded-full">
                  Auto-Update Enabled
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Fast Android application for Customers and Drivers. Real-time GPS movement, background audio alerts, and instant OTP verification.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsApkModalOpen(true)}
                className="py-1.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition"
              >
                Read Info
              </button>
              <a
                href={config.apkLink}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-500 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download APK</span>
              </a>
            </div>
          </div>

          {/* Copyright & Technical Subtext */}
          <div className="text-center text-[11px] text-slate-500 space-y-1">
            <p>© {new Date().getFullYear()} ASSAM EASY TRIP. All Rights Reserved.</p>
            <p>
              Head Office: Bokakhat, Golaghat, Assam pin 785612 • Helpline: 8638803320 / 7002754262
            </p>
          </div>
        </div>
      </footer>

      {/* APK Full Description & Release Info Modal */}
      {isApkModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-2 border-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 text-yellow-400 p-4 sm:p-5 flex items-center justify-between border-b-2 border-yellow-400">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <h3 className="font-black text-white text-base">ASSAM EASY TRIP APK</h3>
                  <p className="text-xs text-yellow-400 font-semibold">Official Android Application v33.2</p>
                </div>
              </div>
              <button
                onClick={() => setIsApkModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="p-3.5 bg-yellow-50 rounded-2xl border border-yellow-300 space-y-1">
                <span className="font-black text-slate-900 text-sm block">📋 APK Description:</span>
                <p className="text-slate-800">
                  <strong>ASSAM EASY TRIP</strong> is Assam's dedicated, real-time regional ride-hailing and fleet management mobile application. Designed specifically for towns and rural routes including <strong>Bokakhat, Golaghat, Kaziranga (Kohora/Bagori), Numaligarh, Dergaon, and Jorhat</strong>, it connects local commuters with verified auto, bike, scooty, and taxi drivers.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-black text-slate-900 text-xs uppercase tracking-wider block">
                  ✨ Key Features in this APK Version (v33.2):
                </span>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>Live Interactive Route Map:</strong> Real-time vehicle rotation, speed calculation, and blue dotted line route navigation without extra API fees.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>Dual Pickup & Drop Tap Selection:</strong> One-tap map toggle for setting pickup and destination drop points accurately anywhere in Assam.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>Continuous Loud Ringtone for Drivers:</strong> Synthesized audio siren/bell alert that rings continuously when a new ride arrives, until the driver accepts.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>4-Digit Security OTP System:</strong> Customer receives a 4-digit code that the driver must verify before completing the trip and collecting fare.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>Driver Commission QR & UPI:</strong> Dedicated driver payment card displaying Admin QR Code and UPI ID for daily/monthly commission settlement.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <div>
                      <strong>Real-Time Cloud Auto-Update:</strong> Configured with Firebase Realtime Database and Firestore so admin rate adjustments sync automatically to the APK without reinstalling.
                    </div>
                  </li>
                </ul>
              </div>

              {/* Head office & Contacts info in modal */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2">
                <div className="font-bold text-yellow-400">🏢 Head Office & Support:</div>
                <div className="text-slate-300">
                  <div><strong>Address:</strong> Bokakhat, Golaghat, Assam pin 785612</div>
                  <div><strong>Phone:</strong> 8638803320, 7002754262</div>
                  <div><strong>Hours:</strong> 24x7 Customer & Driver Support</div>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={config.apkLink}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg transition border-2 border-slate-950"
                >
                  <Download className="w-4 h-4" />
                  <span>Download APK Now (Direct Link)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sound Settings Modal */}
      {isSoundModalOpen && (
        <SoundSettingsModal
          soundConfig={soundConfig}
          onUpdate={(updated) => setSoundConfig(updated)}
          onClose={() => setIsSoundModalOpen(false)}
        />
      )}

      {/* Customer Login / Register Modal */}
      {isCustomerAuthOpen && (
        <CustomerAuthModal
          currentUser={currentCustomer}
          onLoginSuccess={handleCustomerLoginSuccess}
          onLogout={handleCustomerLogout}
          onClose={() => setIsCustomerAuthOpen(false)}
        />
      )}
    </div>
  );
}
