import React, { useState } from 'react';
import { User, Phone, Lock, X, LogIn, UserPlus, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { CustomerUser } from '../types';
import { getCustomers, saveCustomers, setCurrentCustomer } from '../services/storage';

interface Props {
  currentUser: CustomerUser | null;
  onLoginSuccess: (user: CustomerUser) => void;
  onLogout: () => void;
  onClose: () => void;
}

export const CustomerAuthModal: React.FC<Props> = ({ currentUser, onLoginSuccess, onLogout, onClose }) => {
  const [tab, setTab] = useState<'login' | 'register'>(currentUser ? 'login' : 'login');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg('Kripya apna phone number dalein.');
      return;
    }

    const customers = getCustomers();
    const existing = customers.find(c => c.phone === cleanPhone);

    if (existing) {
      if (password && existing.pass && existing.pass !== password) {
        setErrorMsg('Galat Password! Kripya sahi password enter karein.');
        return;
      }
      // Successful login
      setCurrentCustomer(existing);
      setSuccessMsg(`Swagat hai, ${existing.name}!`);
      setTimeout(() => {
        onLoginSuccess(existing);
        onClose();
      }, 700);
    } else {
      // Auto register if customer doesn't exist yet (Quick Helpful Flow)
      const newUser: CustomerUser = {
        id: `cust_${Date.now()}`,
        name: name.trim() || `Customer ${cleanPhone.slice(-4)}`,
        phone: cleanPhone,
        pass: password || '1234',
        createdAt: new Date().toLocaleDateString()
      };
      customers.push(newUser);
      saveCustomers(customers);
      setCurrentCustomer(newUser);
      setSuccessMsg(`Naya account ban gaya! Swagat hai, ${newUser.name}!`);
      setTimeout(() => {
        onLoginSuccess(newUser);
        onClose();
      }, 800);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    if (!cleanPhone || !cleanName) {
      setErrorMsg('Naam aur Phone number dono zaroori hain.');
      return;
    }

    const customers = getCustomers();
    if (customers.find(c => c.phone === cleanPhone)) {
      setErrorMsg('Yeh Phone number pehle se registered hai! Kripya Login karein.');
      setTab('login');
      return;
    }

    const newUser: CustomerUser = {
      id: `cust_${Date.now()}`,
      name: cleanName,
      phone: cleanPhone,
      pass: password || '1234',
      createdAt: new Date().toLocaleDateString()
    };

    customers.push(newUser);
    saveCustomers(customers);
    setCurrentCustomer(newUser);
    setSuccessMsg(`Registration Safal! Swagat hai, ${cleanName}!`);
    setTimeout(() => {
      onLoginSuccess(newUser);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border-2 border-slate-900 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-yellow-400 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center text-xl">
              <User className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Customer Portal</h2>
              <p className="text-xs text-yellow-400/80">Login to save rides & quick book</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logged in state view */}
        {currentUser ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-100 border-2 border-yellow-400 text-yellow-700 mx-auto flex items-center justify-center text-2xl font-black">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{currentUser.name}</h3>
              <p className="text-sm font-semibold text-slate-500">📱 {currentUser.phone}</p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold mt-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Verified Customer Account
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left text-xs space-y-2 text-slate-700">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-yellow-600" />
                <span>Customer Benefits Active:</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Booking me phone & naam auto-fill hoga</li>
                <li>Live blue dot map tracking with driver movement</li>
                <li>Rides history & instant re-booking</li>
              </ul>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-yellow-400 text-slate-950 font-extrabold rounded-xl hover:bg-yellow-500 transition"
              >
                Booking Page Par Jayein
              </button>
              <button
                onClick={() => {
                  onLogout();
                  setPhone('');
                  setName('');
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        ) : (
          /* Form for Login / Register */
          <div className="p-5 sm:p-6 space-y-4">
            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tab === 'login'
                    ? 'bg-slate-900 text-yellow-400 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Customer Login</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg('');
                }}
                className={`flex-1 py-2 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 ${
                  tab === 'register'
                    ? 'bg-slate-900 text-yellow-400 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Register</span>
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-300 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-green-50 border border-green-300 text-green-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={tab === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {tab === 'register' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Aapka Pura Naam *</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Gogoi"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-yellow-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Phone Number (Login ID) *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Password / Pin (Optional)</label>
                  <span className="text-[10px] text-slate-400">Default: 1234</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Enter password or leave blank for default"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-extrabold rounded-xl transition shadow-sm mt-3 flex items-center justify-center gap-2"
              >
                {tab === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Login & Continue Booking</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Register Account</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
              >
                Bina Login Ke Guest Booking Jari Rakhein →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
