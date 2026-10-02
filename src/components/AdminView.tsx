import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  ShieldCheck, Download, Trash2, CheckCircle, XCircle, Lock, Unlock, Plus,
  Settings, DollarSign, Users, MapPin, QrCode, Edit, Save, Upload, Copy,
  Phone, Mail, Check, CreditCard, RefreshCw, Key, Navigation, FileSpreadsheet
} from 'lucide-react';
import { AppConfig, Booking, Driver, DriverPayment, VehicleConfig } from '../types';
import {
  getBookings, getDrivers, getDriverPayments, saveAppConfig, saveBookings,
  saveDrivers, saveDriverPayments
} from '../services/storage';
import { subscribeToAllBookings, subscribeToAllDrivers } from '../services/firebase';
import { LiveRouteMap } from './LiveRouteMap';

interface Props {
  config: AppConfig;
  onUpdateConfig: (cfg: AppConfig) => void;
}

export const AdminView: React.FC<Props> = ({ config, onUpdateConfig }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<
    'bookings' | 'drivers' | 'map' | 'rates' | 'commissions' | 'payments' | 'qr' | 'design' | 'settings' | 'excel'
  >('bookings');

  const [drivers, setDrivers] = useState<Driver[]>(getDrivers());
  const [bookings, setBookings] = useState<Booking[]>(getBookings());
  const [payments, setPayments] = useState<DriverPayment[]>(getDriverPayments());
  const [selectedMapBooking, setSelectedMapBooking] = useState<Booking | null>(bookings[0] || null);
  const [loginError, setLoginError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Drivers Filter & Edit State
  const [driverFilter, setDriverFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // New Vehicle state
  const [newVehName, setNewVehName] = useState('');
  const [newVehRate, setNewVehRate] = useState(15);
  const [newVehIcon, setNewVehIcon] = useState('🚗');
  const [newVehDailyComm, setNewVehDailyComm] = useState(100);
  const [newVehMonthlyComm, setNewVehMonthlyComm] = useState(2000);

  // New Location state
  const [newLocName, setNewLocName] = useState('');

  // Payment Recording State
  const [payPhone, setPayPhone] = useState('');
  const [payVeh, setPayVeh] = useState(config.vehicles[0]?.name || 'Bike');
  const [payAmt, setPayAmt] = useState<number>(100);
  const [payType, setPayType] = useState<'Daily' | 'Monthly'>('Daily');
  const [payNote, setPayNote] = useState('');

  // Editable Config Local State
  const [localCfg, setLocalCfg] = useState<AppConfig>({ ...config });

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Real-time Firestore onSnapshot for Bookings & Fleet Drivers
  useEffect(() => {
    const unsubBookings = subscribeToAllBookings((remoteBookings) => {
      if (remoteBookings) {
        setBookings(remoteBookings);
        setSelectedMapBooking(prev => {
          if (!prev && remoteBookings.length > 0) return remoteBookings[0];
          if (prev) {
            const updated = remoteBookings.find(b => b.id === prev.id);
            return updated || prev;
          }
          return null;
        });
      }
    });

    const unsubDrivers = subscribeToAllDrivers((remoteDrivers) => {
      if (remoteDrivers && remoteDrivers.length > 0) {
        setDrivers(remoteDrivers);
      }
    });

    return () => {
      if (typeof unsubBookings === 'function') unsubBookings();
      if (typeof unsubDrivers === 'function') unsubDrivers();
    };
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (username === config.adminCred.user && password === config.adminCred.pass) ||
      (username === 'admin' && password === 'admin123') ||
      password === '1234'
    ) {
      setIsLoggedIn(true);
      setLoginError('');
      setDrivers(getDrivers());
      setBookings(getBookings());
      setPayments(getDriverPayments());
      setLocalCfg({ ...config });
    } else {
      setLoginError('Galat Username ya Password! Master Key: 1234');
    }
  };

  // 1. DRIVER ACTIONS
  const handleApproveDriver = (id: number) => {
    const updated = drivers.map(d => d.id === id ? { ...d, status: 'approved' as const } : d);
    setDrivers(updated);
    saveDrivers(updated);
    showToast('Driver Approve Ho Gaya!');
  };

  const handleRejectDriver = (id: number) => {
    if (!confirm('Kya aap is driver ko delete karna chahte hain?')) return;
    const updated = drivers.filter(d => d.id !== id);
    setDrivers(updated);
    saveDrivers(updated);
    showToast('Driver Delete Ho Gaya.');
  };

  const handleToggleLockDriver = (id: number) => {
    const updated = drivers.map(d => d.id === id ? { ...d, locked: !d.locked } : d);
    setDrivers(updated);
    saveDrivers(updated);
    showToast('Driver status update ho gaya!');
  };

  const handleSaveDriverEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    const updated = drivers.map(d => d.id === editingDriver.id ? editingDriver : d);
    setDrivers(updated);
    saveDrivers(updated);
    setEditingDriver(null);
    showToast('Driver details safalta-purvak update hui!');
  };

  // 2. RATES & COMMISSION ACTIONS
  const handleVehicleRateChange = (index: number, newRate: number) => {
    const updatedVehicles = [...localCfg.vehicles];
    updatedVehicles[index].rate = newRate;
    const updated = { ...localCfg, vehicles: updatedVehicles };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
  };

  const handleDailyCommissionChange = (index: number, val: number) => {
    const updatedVehicles = [...localCfg.vehicles];
    updatedVehicles[index].commissionDaily = val;
    const updated = { ...localCfg, vehicles: updatedVehicles };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
  };

  const handleMonthlyCommissionChange = (index: number, val: number) => {
    const updatedVehicles = [...localCfg.vehicles];
    updatedVehicles[index].commissionMonthly = val;
    const updated = { ...localCfg, vehicles: updatedVehicles };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
  };

  const handleBaseFareChange = (val: number) => {
    const updated = { ...localCfg, baseFare: val };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
  };

  const handleAddVehicle = () => {
    if (!newVehName.trim()) return;
    const newV: VehicleConfig = {
      name: newVehName.trim(),
      rate: Number(newVehRate) || 15,
      icon: newVehIcon || '🚗',
      commissionDaily: Number(newVehDailyComm) || 100,
      commissionMonthly: Number(newVehMonthlyComm) || 2000
    };
    const updated = {
      ...localCfg,
      vehicles: [...localCfg.vehicles, newV]
    };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
    setNewVehName('');
    showToast('Nayi gari add ho gayi!');
  };

  const handleDeleteVehicle = (index: number) => {
    if (localCfg.vehicles.length <= 1) {
      alert('Kam se kam ek vehicle rehna zaroori hai.');
      return;
    }
    const updatedVehicles = [...localCfg.vehicles];
    updatedVehicles.splice(index, 1);
    const updated = { ...localCfg, vehicles: updatedVehicles };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
    showToast('Vehicle delete ho gaya.');
  };

  // 3. PAYMENT ACTIONS
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPhone.trim() || !payAmt) {
      alert('Driver Phone aur Amount zaroori hai!');
      return;
    }
    const newPayment: DriverPayment = {
      id: Date.now(),
      phone: payPhone.trim(),
      driverName: drivers.find(d => d.phone === payPhone.trim())?.name || 'Driver',
      vehicle: payVeh,
      amt: Number(payAmt),
      type: payType,
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: payNote.trim()
    };
    const updated = [newPayment, ...payments];
    setPayments(updated);
    saveDriverPayments(updated);
    setPayPhone('');
    setPayNote('');
    showToast('Payment record add ho gaya!');
  };

  const handleDeletePayment = (id: number) => {
    const updated = payments.filter(p => p.id !== id);
    setPayments(updated);
    saveDriverPayments(updated);
    showToast('Payment record delete ho gaya.');
  };

  // 4. QR CODE UPLOAD / EDIT
  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const updated = { ...localCfg, qr: dataUrl };
      setLocalCfg(updated);
      onUpdateConfig(updated);
      saveAppConfig(updated);
      showToast('QR Code Image Upload Ho Gayi!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQRDetails = () => {
    onUpdateConfig(localCfg);
    saveAppConfig(localCfg);
    showToast('UPI ID & QR Settings Save Ho Gayi!');
  };

  // 5. DESIGN & SETTINGS SAVE
  const handleSaveAllSettings = () => {
    onUpdateConfig(localCfg);
    saveAppConfig(localCfg);
    showToast('Sabhi Design & System Settings Save Ho Gayi!');
  };

  // 6. LOCATIONS ACTIONS
  const handleAddLocation = () => {
    if (!newLocName.trim()) return;
    const name = newLocName.trim();
    if (localCfg.locations.includes(name)) {
      alert('Yeh location pehle se exist karti hai.');
      return;
    }
    const updated = {
      ...localCfg,
      locations: [...localCfg.locations, name]
    };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
    setNewLocName('');
    showToast('Nayi location add ho gayi!');
  };

  const handleDeleteLocation = (name: string) => {
    const updated = {
      ...localCfg,
      locations: localCfg.locations.filter(l => l !== name)
    };
    setLocalCfg(updated);
    onUpdateConfig(updated);
    saveAppConfig(updated);
    showToast('Location delete ho gayi.');
  };

  // 7. COMPREHENSIVE EXCEL EXPORT (EVERY ENTITY DOWNLOADABLE)
  const handleExportExcel = (type: 'all' | 'drivers' | 'bookings' | 'completed' | 'pending' | 'payments' | 'rates') => {
    const wb = XLSX.utils.book_new();

    if (type === 'drivers' || type === 'all') {
      const wsDrivers = XLSX.utils.json_to_sheet(
        drivers.map(d => ({
          'Driver ID': d.id,
          'Full Name': d.name,
          'Phone (Login)': d.phone,
          'Vehicle Number': d.vehno,
          'Vehicle Type': d.vtype,
          'Home Location': d.loc,
          'Approval Status': d.status.toUpperCase(),
          'Account Locked': d.locked ? 'YES (Blocked)' : 'NO (Active)',
          'Registration Date': d.created
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsDrivers, 'Drivers');
    }

    if (type === 'bookings' || type === 'all') {
      const wsBookings = XLSX.utils.json_to_sheet(
        bookings.map(b => ({
          'Booking ID': b.id,
          'Customer Name': b.name,
          'Customer Phone': b.phone,
          'Pickup (From)': b.fromName,
          'Drop (To)': b.toName,
          'Vehicle': b.vehicle,
          'Fare (₹)': b.price,
          'Distance (KM)': b.km,
          'Security OTP': b.otp,
          'Ride Status': b.status.toUpperCase(),
          'Assigned Driver Phone': b.driver || 'None',
          'Assigned Driver Name': b.driverName || 'None',
          'Booking Time': b.time,
          'Completed At': b.completedAt || '-'
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsBookings, 'All Bookings');
    }

    if (type === 'completed' || type === 'all') {
      const completedList = bookings.filter(b => b.status === 'completed');
      const wsCompleted = XLSX.utils.json_to_sheet(
        completedList.map(b => ({
          'Trip ID': b.id,
          'Customer Name': b.name,
          'Customer Phone': b.phone,
          'Pickup Location': b.fromName,
          'Drop Location': b.toName,
          'Vehicle': b.vehicle,
          'Fare Paid': b.price,
          'Distance KM': b.km,
          'Driver Name': b.driverName || b.driver || 'Driver',
          'Driver Phone': b.driver || '',
          'Completed Time': b.completedAt || b.time
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsCompleted, 'Completed Trips');
    }

    if (type === 'pending' || type === 'all') {
      const pendingList = bookings.filter(b => b.status === 'pending');
      const wsPending = XLSX.utils.json_to_sheet(
        pendingList.map(b => ({
          'Booking ID': b.id,
          'Customer Name': b.name,
          'Customer Phone': b.phone,
          'Pickup Location': b.fromName,
          'Drop Location': b.toName,
          'Vehicle Type': b.vehicle,
          'Estimated Fare': b.price,
          'Distance KM': b.km,
          'OTP': b.otp,
          'Requested Time': b.time
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Bookings');
    }

    if (type === 'payments' || type === 'all') {
      const wsPayments = XLSX.utils.json_to_sheet(
        payments.map(p => ({
          'Payment ID': p.id,
          'Driver Phone': p.phone,
          'Driver Name': p.driverName || 'Driver',
          'Vehicle': p.vehicle,
          'Commission Amount (₹)': p.amt,
          'Payment Type': p.type,
          'Receipt Date': p.date,
          'Admin Note': p.note || ''
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsPayments, 'Commission Payments');
    }

    if (type === 'rates' || type === 'all') {
      const wsRates = XLSX.utils.json_to_sheet(
        localCfg.vehicles.map(v => ({
          'Vehicle Type': v.name,
          'Icon': v.icon,
          'Customer Rate Per KM (₹)': v.rate,
          'Driver Daily Commission (₹)': v.commissionDaily,
          'Driver Monthly Commission (₹)': v.commissionMonthly
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsRates, 'Vehicle Rates & Commission');
    }

    XLSX.writeFile(wb, `ASSAM_EASY_TRIP_${type.toUpperCase()}_REPORT_${Date.now()}.xlsx`);
    showToast(`Excel Sheet (${type.toUpperCase()}) Downloaded!`);
  };

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-6 shadow-xl border-2 border-slate-900 space-y-4">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-slate-900 text-yellow-400 font-black rounded-2xl flex items-center justify-center mx-auto text-2xl border border-yellow-400 shadow-md">
            🔒
          </div>
          <h2 className="text-xl font-black text-slate-900">Admin Control Portal</h2>
          <p className="text-xs text-slate-500">Logo 5 Click Unlocked • Secure Dashboard</p>
        </div>

        {loginError && (
          <div className="bg-rose-50 border border-rose-300 text-rose-700 p-3 rounded-xl text-xs font-bold">
            ⚠️ {loginError}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Admin Username</label>
            <input
              type="text"
              required
              placeholder="e.g. admin"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="Admin password (or Master: 1234)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black rounded-xl text-sm transition shadow-md"
          >
            Admin Sign In
          </button>
        </form>
      </div>
    );
  }

  // Filtered drivers
  const displayedDrivers = drivers.filter(d => {
    if (driverFilter === 'pending') return d.status === 'pending';
    if (driverFilter === 'approved') return d.status === 'approved';
    return true;
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-[10000] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white text-xs font-black flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-slate-900 text-yellow-400 p-4 sm:p-5 rounded-3xl border-2 border-yellow-400 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-lg shadow-md">
            ⚙️
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Admin Master Control v33.2</h2>
            <p className="text-xs text-yellow-400/80">Full System Customizer & Edit Suite</p>
          </div>
        </div>

        <button
          onClick={() => setIsLoggedIn(false)}
          className="py-1.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
        >
          Logout Admin
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl gap-1 overflow-x-auto">
        {[
          { id: 'bookings', label: `📍 Bookings (${bookings.length})` },
          { id: 'drivers', label: `🚗 Drivers (${drivers.length})` },
          { id: 'map', label: '🗺️ Live Fleet Map' },
          { id: 'rates', label: '🛺 Customer Rates' },
          { id: 'commissions', label: '💰 Driver Commission' },
          { id: 'payments', label: `💳 Payments (${payments.length})` },
          { id: 'qr', label: '📱 Admin QR & UPI' },
          { id: 'design', label: '🎨 Design & Texts' },
          { id: 'settings', label: '⚙️ Settings & Locations' },
          { id: 'excel', label: '📊 Excel Reports' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`py-2 px-3.5 rounded-xl text-xs font-black whitespace-nowrap transition ${
              activeTab === t.id
                ? 'bg-slate-900 text-yellow-400 shadow-md'
                : 'text-slate-700 hover:text-slate-950'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. BOOKINGS TAB */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">Live & Past Bookings</h3>
            <button
              onClick={() => {
                if (confirm('Saari completed bookings clear karni hain?')) {
                  const remaining = bookings.filter(b => b.status !== 'completed');
                  setBookings(remaining);
                  saveBookings(remaining);
                  showToast('Completed bookings clear ho gayi.');
                }
              }}
              className="text-xs text-rose-600 hover:underline font-bold"
            >
              Clear Completed
            </button>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {bookings.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Koi booking nahi mili.</div>
            ) : (
              bookings.map(b => (
                <div key={b.id} className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-extrabold text-slate-900">
                      👤 {b.name} ({b.phone}) • <span className="text-blue-600 font-black">{b.price}</span> ({b.km} KM)
                    </div>
                    <div className="text-slate-600 font-semibold mt-0.5">
                      📍 {b.fromName} → 🏁 {b.toName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      OTP: <strong>{b.otp}</strong> • Vehicle: {b.vehicle} • Driver: {b.driver || 'Pending'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        b.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.status === 'accepted'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {b.status.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const updated = bookings.filter(x => x.id !== b.id);
                        setBookings(updated);
                        saveBookings(updated);
                        showToast('Booking delete ho gayi.');
                      }}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. DRIVERS TAB (APPROVAL & MANAGEMENT) */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Driver Verification & Approval</h3>
              <p className="text-xs text-slate-500">Approve new registrations, edit details, lock/unlock accounts</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
              <button
                onClick={() => setDriverFilter('all')}
                className={`py-1 px-3 rounded-lg ${driverFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
              >
                All ({drivers.length})
              </button>
              <button
                onClick={() => setDriverFilter('pending')}
                className={`py-1 px-3 rounded-lg ${driverFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-slate-600'}`}
              >
                Pending ({drivers.filter(d => d.status === 'pending').length})
              </button>
              <button
                onClick={() => setDriverFilter('approved')}
                className={`py-1 px-3 rounded-lg ${driverFilter === 'approved' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
              >
                Approved ({drivers.filter(d => d.status === 'approved').length})
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {displayedDrivers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">Koi driver is category me nahi mila.</div>
            ) : (
              displayedDrivers.map(d => (
                <div key={d.id} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={d.photo}
                      alt={d.name}
                      className="w-14 h-14 rounded-full object-cover border-2 border-slate-900 shadow-xs"
                    />
                    <div>
                      <div className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <span>{d.name}</span>
                        <span className="text-xs bg-slate-900 text-yellow-400 px-2 py-0.2 rounded font-bold">
                          {d.vtype}
                        </span>
                        {d.locked && (
                          <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
                            LOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-0.5">
                        📱 {d.phone} • Gari No: <span className="font-black text-slate-900">{d.vehno}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Location: {d.loc} • Registered: {d.created}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Approve / Status */}
                    {d.status === 'pending' ? (
                      <button
                        onClick={() => handleApproveDriver(d.id)}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    ) : (
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full border border-emerald-300">
                        ✓ Approved
                      </span>
                    )}

                    {/* Edit Driver */}
                    <button
                      onClick={() => setEditingDriver({ ...d })}
                      className="p-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-800 text-xs font-bold"
                      title="Edit Driver Details"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Lock / Unlock */}
                    <button
                      onClick={() => handleToggleLockDriver(d.id)}
                      className="p-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-slate-700 text-xs font-bold"
                      title={d.locked ? 'Unlock Driver' : 'Lock Driver'}
                    >
                      {d.locked ? <Lock className="w-4 h-4 text-rose-600" /> : <Unlock className="w-4 h-4" />}
                    </button>

                    {/* Reject / Delete */}
                    <button
                      onClick={() => handleRejectDriver(d.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                      title="Delete Driver"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Edit Driver Modal */}
          {editingDriver && (
            <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3">
              <div className="bg-white w-full max-w-md rounded-3xl p-5 border-2 border-slate-900 shadow-2xl space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-black text-slate-900">Edit Driver Details</h3>
                  <button onClick={() => setEditingDriver(null)} className="font-bold text-sm text-slate-400 hover:text-slate-900">✕</button>
                </div>
                <form onSubmit={handleSaveDriverEdit} className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">Driver Name</label>
                    <input
                      type="text"
                      required
                      value={editingDriver.name}
                      onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">Phone (Login ID)</label>
                    <input
                      type="tel"
                      required
                      value={editingDriver.phone}
                      onChange={e => setEditingDriver({ ...editingDriver, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">Vehicle Number</label>
                    <input
                      type="text"
                      required
                      value={editingDriver.vehno}
                      onChange={e => setEditingDriver({ ...editingDriver, vehno: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block">Vehicle Type</label>
                    <select
                      value={editingDriver.vtype}
                      onChange={e => setEditingDriver({ ...editingDriver, vtype: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                    >
                      {localCfg.vehicles.map(v => (
                        <option key={v.name} value={v.name}>{v.icon} {v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-yellow-400 font-extrabold text-xs rounded-xl text-slate-950 hover:bg-yellow-500"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDriver(null)}
                      className="py-2.5 px-4 bg-slate-200 text-xs font-bold rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2.5 LIVE FLEET MAP TAB */}
      {activeTab === 'map' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>🗺️ Live Fleet & Booking Map</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Live GPS
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Puri fleet, active rides, pickup/drop locations aur blue dot route live track karein
              </p>
            </div>

            {/* Quick stats readout */}
            <div className="flex items-center gap-2">
              <span className="text-xs bg-slate-900 text-yellow-400 font-bold px-3 py-1.5 rounded-xl">
                🚗 {drivers.length} Drivers
              </span>
              <span className="text-xs bg-blue-50 text-blue-700 font-bold px-3 py-1.5 rounded-xl border border-blue-200">
                📍 {bookings.filter(b => b.status === 'accepted' || b.status === 'pending').length} Active/Pending
              </span>
            </div>
          </div>

          {/* Booking / Fleet Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Select Booking to Focus Route:</span>
            <select
              value={selectedMapBooking?.id || ''}
              onChange={(e) => {
                const b = bookings.find(x => x.id === Number(e.target.value));
                setSelectedMapBooking(b || null);
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {bookings.length === 0 ? (
                <option value="">No Bookings Available</option>
              ) : (
                bookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.vehicle}) - {b.fromName} → {b.toName} [{b.status.toUpperCase()}]
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Embedded Live Map */}
          <LiveRouteMap
            mapId="admin-live-fleet-map"
            fromCoords={selectedMapBooking?.fromLat ? [selectedMapBooking.fromLat, selectedMapBooking.fromLng] : undefined}
            toCoords={selectedMapBooking?.toLat ? [selectedMapBooking.toLat, selectedMapBooking.toLng] : undefined}
            fromLabel={selectedMapBooking ? selectedMapBooking.fromName : 'Pickup'}
            toLabel={selectedMapBooking ? selectedMapBooking.toName : 'Drop'}
            driverCoords={selectedMapBooking?.driverLoc ? [selectedMapBooking.driverLoc.lat, selectedMapBooking.driverLoc.lng] : [26.6247, 93.6035]}
            driverName={selectedMapBooking?.driverName || 'Driver'}
            driverVehicleIcon={config.vehicles.find(v => v.name === selectedMapBooking?.vehicle)?.icon || '🚗'}
            fleetDrivers={drivers}
            showBlueDotLine={true}
            height="380px"
          />

          {/* Live Driver Fleet Overview Cards */}
          <div className="pt-2">
            <h4 className="text-xs font-black text-slate-700 mb-2">Registered Drivers Fleet Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {drivers.map(d => (
                <div key={d.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2.5">
                  <img src={d.photo} alt={d.name} className="w-9 h-9 rounded-full object-cover border border-slate-800" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-bold text-slate-900 truncate">{d.name}</div>
                    <div className="text-[10px] text-slate-500">{d.vtype} • {d.vehno}</div>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${d.locked ? 'bg-rose-500' : 'bg-emerald-500'}`} title={d.locked ? 'Locked' : 'Active'}></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. CUSTOMER RATES TAB (CUSTOMER RET CHENG) */}
      {activeTab === 'rates' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Customer Ret Cheng (Rate Per KM & Base Fare)</h3>
              <p className="text-xs text-slate-500">Edit per kilometer rates and minimum booking fare for customers</p>
            </div>
          </div>

          {/* Base Fare Setting */}
          <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-amber-950 block">Customer Minimum Base Fare (₹)</span>
              <span className="text-[11px] text-amber-800">Booking shuru hone par judne wala starting charge</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-black text-slate-900">₹</span>
              <input
                type="number"
                min="0"
                value={localCfg.baseFare || 40}
                onChange={e => handleBaseFareChange(Number(e.target.value))}
                className="w-24 px-3 py-2 bg-white border-2 border-amber-400 rounded-xl text-sm font-black text-slate-900 text-center"
              />
            </div>
          </div>

          {/* Per Vehicle Rate Editor */}
          <div className="space-y-2.5">
            <label className="text-xs font-extrabold text-slate-700 block">Vehicle Rates (Per KM)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localCfg.vehicles.map((v, i) => (
                <div key={v.name} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{v.icon}</span>
                    <div>
                      <div className="text-xs font-black text-slate-900">{v.name}</div>
                      <div className="text-[10px] text-slate-500">Current: ₹{v.rate}/km</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-500">₹</span>
                      <input
                        type="number"
                        min="1"
                        value={v.rate}
                        onChange={e => handleVehicleRateChange(i, Number(e.target.value))}
                        className="w-20 px-2 py-1.5 bg-white border-2 border-slate-300 rounded-lg text-xs font-black text-center focus:border-yellow-400 focus:outline-none"
                      />
                      <span className="text-[10px] font-bold text-slate-400">/km</span>
                    </div>
                    <button
                      onClick={() => handleDeleteVehicle(i)}
                      className="p-1.5 text-rose-500 hover:text-rose-700"
                      title="Delete Vehicle"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Vehicle Form */}
          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
            <span className="text-xs font-black text-slate-900 block">+ Add New Vehicle Type</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Name (e.g. E-Rickshaw)"
                value={newVehName}
                onChange={e => setNewVehName(e.target.value)}
                className="px-3 py-2 border rounded-xl text-xs font-semibold"
              />
              <input
                type="number"
                placeholder="Rate/km (₹)"
                value={newVehRate}
                onChange={e => setNewVehRate(Number(e.target.value))}
                className="px-3 py-2 border rounded-xl text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Icon (e.g. 🛺)"
                value={newVehIcon}
                onChange={e => setNewVehIcon(e.target.value)}
                className="px-3 py-2 border rounded-xl text-xs text-center font-semibold"
              />
              <button
                type="button"
                onClick={handleAddVehicle}
                className="py-2 px-4 bg-yellow-400 hover:bg-yellow-500 font-extrabold text-xs rounded-xl text-slate-950 transition shadow-xs"
              >
                + Add Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DRIVER COMMISSION TAB (DAILY & MONTHLY AMOUNTS TO PAY ADMIN) */}
      {activeTab === 'commissions' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-base font-black text-slate-900">
              Driver Daily / Monthly Commission Rate Editor
            </h3>
            <p className="text-xs text-slate-500">
              Har gari ke driver dwara admin ko har din ya mahine pay karne wala amount yaha edit karein (Driver portal me show karega)
            </p>
          </div>

          <div className="space-y-3">
            {localCfg.vehicles.map((v, i) => (
              <div key={v.name} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{v.icon}</span>
                  <div>
                    <div className="text-sm font-black text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-500">Customer Rate: ₹{v.rate}/km</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Daily Commission */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-300">
                    <label className="text-[10px] font-extrabold text-amber-700 block uppercase">
                      Daily Commission (₹)
                    </label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-bold text-slate-600">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={v.commissionDaily}
                        onChange={e => handleDailyCommissionChange(i, Number(e.target.value))}
                        className="w-24 px-2 py-1 bg-amber-50/50 border border-amber-300 rounded text-xs font-black text-slate-900 text-center"
                      />
                      <span className="text-[10px] text-slate-400">/day</span>
                    </div>
                  </div>

                  {/* Monthly Commission */}
                  <div className="bg-white p-2.5 rounded-xl border border-slate-300">
                    <label className="text-[10px] font-extrabold text-emerald-700 block uppercase">
                      Monthly Commission (₹)
                    </label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-bold text-slate-600">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={v.commissionMonthly}
                        onChange={e => handleMonthlyCommissionChange(i, Number(e.target.value))}
                        className="w-24 px-2 py-1 bg-emerald-50/50 border border-emerald-300 rounded text-xs font-black text-slate-900 text-center"
                      />
                      <span className="text-[10px] text-slate-400">/month</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 text-right">
            <button
              onClick={() => showToast('Commission Rates Updated & Active!')}
              className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-xl shadow-md transition"
            >
              💾 Save Commission Rates
            </button>
          </div>
        </div>
      )}

      {/* 5. PAYMENTS MANAGEMENT TAB */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-base font-black text-slate-900">Record & Track Driver Payments</h3>
            <p className="text-xs text-slate-500">Drivers se prapt hue Daily / Monthly payment ka record rakhein</p>
          </div>

          {/* Record payment form */}
          <form onSubmit={handleRecordPayment} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 space-y-3">
            <span className="text-xs font-black text-slate-900 block">+ Add Received Driver Payment</span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Driver Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={payPhone}
                  onChange={e => setPayPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Vehicle Type</label>
                <select
                  value={payVeh}
                  onChange={e => setPayVeh(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                >
                  {localCfg.vehicles.map(v => (
                    <option key={v.name} value={v.name}>{v.icon} {v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="Amount"
                  value={payAmt}
                  onChange={e => setPayAmt(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Payment Frequency</label>
                <select
                  value={payType}
                  onChange={e => setPayType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                >
                  <option value="Daily">Daily Commission</option>
                  <option value="Monthly">Monthly Commission</option>
                </select>
              </div>
            </div>
            <div>
              <input
                type="text"
                placeholder="Optional Note (e.g. Paid via GPay / Cash for September)"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl text-xs"
              />
            </div>
            <button
              type="submit"
              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition"
            >
              ✅ Record Payment
            </button>
          </form>

          {/* Payments list */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-700">Payment History ({payments.length})</h4>
            {payments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">Koi payment record nahi mila.</div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {payments.map(p => (
                  <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-900">
                        📱 {p.phone} ({p.driverName || 'Driver'}) • {p.vehicle}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.date} • <span className="font-bold text-blue-600">{p.type}</span> {p.note && `• Note: ${p.note}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-base font-black text-emerald-600">₹{p.amt}</div>
                      <button
                        onClick={() => handleDeletePayment(p.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ADMIN QR CODE & UPI EDIT TAB */}
      {activeTab === 'qr' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-base font-black text-slate-900">Admin QR Code & UPI Configuration</h3>
            <p className="text-xs text-slate-500">
              Yaha aap apna QR Code aur UPI set karein - Yeh Driver Portal me seedha dikhega
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Admin UPI ID *</label>
                <input
                  type="text"
                  placeholder="e.g. admin@upi or 9876543210@paytm"
                  value={localCfg.upi}
                  onChange={e => setLocalCfg({ ...localCfg, upi: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Upload New QR Code Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-xl text-xs text-slate-600"
                />
                <span className="text-[10px] text-slate-400 block mt-1">PNG, JPG format accepted</span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Or QR Code Image URL</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={localCfg.qr}
                  onChange={e => setLocalCfg({ ...localCfg, qr: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">QR Payment Instruction Note</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Driver Daily 200 Monthly 4000. Screenshot bhej kar approve karwayein."
                  value={localCfg.qrNote}
                  onChange={e => setLocalCfg({ ...localCfg, qrNote: e.target.value })}
                  className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveQRDetails}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-xl shadow-md transition"
              >
                💾 Save QR & UPI Settings
              </button>
            </div>

            {/* Live QR Preview (As Driver Sees It) */}
            <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-300 text-center space-y-3">
              <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                Driver Portal Live Preview
              </span>
              <img
                src={localCfg.qr}
                alt="Admin QR Preview"
                className="w-44 h-44 mx-auto rounded-2xl border-3 border-slate-950 shadow-md bg-white object-contain p-2"
              />
              <div>
                <div className="text-xs font-bold text-slate-500">Admin UPI:</div>
                <div className="text-sm font-black text-slate-900">{localCfg.upi}</div>
              </div>
              <p className="text-xs text-amber-900 font-semibold">{localCfg.qrNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. DESIGN & SYSTEM TEXTS TAB */}
      {activeTab === 'design' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-base font-black text-slate-900">Design, Headings & App Copy Customizer</h3>
            <p className="text-xs text-slate-500">Application ke sabhi labels aur contact details edit karein</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Logo Text</label>
              <input
                type="text"
                value={localCfg.design.logo}
                onChange={e => setLocalCfg({ ...localCfg, design: { ...localCfg.design, logo: e.target.value } })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Customer Heading</label>
              <input
                type="text"
                value={localCfg.design.texts.customerHead}
                onChange={e => setLocalCfg({
                  ...localCfg,
                  design: { ...localCfg.design, texts: { ...localCfg.design.texts, customerHead: e.target.value } }
                })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Driver Heading</label>
              <input
                type="text"
                value={localCfg.design.texts.driverHead}
                onChange={e => setLocalCfg({
                  ...localCfg,
                  design: { ...localCfg.design, texts: { ...localCfg.design.texts, driverHead: e.target.value } }
                })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Book Button Text</label>
              <input
                type="text"
                value={localCfg.design.texts.bookBtn}
                onChange={e => setLocalCfg({
                  ...localCfg,
                  design: { ...localCfg.design, texts: { ...localCfg.design.texts, bookBtn: e.target.value } }
                })}
                className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <h4 className="text-xs font-black text-slate-900">Admin Support & Contact Info</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Admin Name</label>
                <input
                  type="text"
                  value={localCfg.adminDetails.name}
                  onChange={e => setLocalCfg({ ...localCfg, adminDetails: { ...localCfg.adminDetails, name: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Support Phone</label>
                <input
                  type="tel"
                  value={localCfg.adminDetails.phone}
                  onChange={e => setLocalCfg({ ...localCfg, adminDetails: { ...localCfg.adminDetails, phone: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">WhatsApp Number</label>
                <input
                  type="tel"
                  value={localCfg.adminDetails.whatsapp}
                  onChange={e => setLocalCfg({ ...localCfg, adminDetails: { ...localCfg.adminDetails, whatsapp: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAllSettings}
            className="py-3 px-6 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
          >
            💾 Save All Design & Copy
          </button>
        </div>
      )}

      {/* 8. SETTINGS & LOCATIONS TAB */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-5">
          {/* Admin Credentials */}
          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-yellow-600" />
              <span>Admin Username & Password Change</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Admin Username</label>
                <input
                  type="text"
                  value={localCfg.adminCred.user}
                  onChange={e => setLocalCfg({ ...localCfg, adminCred: { ...localCfg.adminCred, user: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block">Admin Password</label>
                <input
                  type="text"
                  value={localCfg.adminCred.pass}
                  onChange={e => setLocalCfg({ ...localCfg, adminCred: { ...localCfg.adminCred, pass: e.target.value } })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-semibold"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">Master emergency password remains: 1234</p>
          </div>

          {/* Locations Management */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Assam Locations Manager ({localCfg.locations.length})</span>
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 rounded-2xl border">
              {localCfg.locations.map(loc => (
                <span
                  key={loc}
                  className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold"
                >
                  <span>📍 {loc}</span>
                  <button
                    onClick={() => handleDeleteLocation(loc)}
                    className="text-slate-400 hover:text-rose-600 ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nayi Location ka Naam (e.g. Moran Town)"
                value={newLocName}
                onChange={e => setNewLocName(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-xl text-xs font-semibold"
              />
              <button
                type="button"
                onClick={handleAddLocation}
                className="py-2 px-4 bg-slate-900 text-yellow-400 font-extrabold text-xs rounded-xl"
              >
                + Add Location
              </button>
            </div>
          </div>

          {/* APK Settings */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
            <h4 className="text-xs font-black text-emerald-950">Android APK Download Link</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="number"
                step="0.1"
                placeholder="APK Version"
                value={localCfg.apkVersion}
                onChange={e => setLocalCfg({ ...localCfg, apkVersion: Number(e.target.value) })}
                className="px-3 py-2 border rounded-xl text-xs font-semibold bg-white"
              />
              <input
                type="text"
                placeholder="APK Download URL"
                value={localCfg.apkLink}
                onChange={e => setLocalCfg({ ...localCfg, apkLink: e.target.value })}
                className="sm:col-span-2 px-3 py-2 border rounded-xl text-xs font-semibold bg-white"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAllSettings}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-xl shadow-md transition"
          >
            💾 Save All System Settings
          </button>
        </div>
      )}

      {/* 9. EXCEL EXPORT TAB */}
      {activeTab === 'excel' && (
        <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-md space-y-5">
          <div className="border-b pb-3">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Comprehensive Excel Data Export Suite (.xlsx)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Admin ke liye har ek record (Drivers, Bookings, Completed Trips, Pending Rides, Payments, Rates) download karne ki suvidha
            </p>
          </div>

          {/* Master Bundle Download Card */}
          <div className="p-4 rounded-2xl bg-yellow-400 text-slate-950 border-2 border-slate-900 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-sm font-black block">🌟 Download Complete Master System Workbook</span>
              <span className="text-xs font-semibold text-slate-800">
                Ek hi file me 6 sheets: Drivers + Bookings + Completed Trips + Pending + Payments + Rates
              </span>
            </div>
            <button
              onClick={() => handleExportExcel('all')}
              className="py-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Full Master Excel (.xlsx)</span>
            </button>
          </div>

          {/* Individual Entity Download Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {/* Drivers */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">🚗 Drivers Database</span>
                <span className="text-[11px] text-slate-500 block">
                  {drivers.length} Drivers • Name, Phone, Vehicle, Approval & Lock status
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('drivers')}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Drivers Sheet</span>
              </button>
            </div>

            {/* All Bookings */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">📍 All Bookings History</span>
                <span className="text-[11px] text-slate-500 block">
                  {bookings.length} Total Bookings • Customer, From/To, Fare & Driver
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('bookings')}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>All Bookings Sheet</span>
              </button>
            </div>

            {/* Completed Trips */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">✅ Completed Trips Only</span>
                <span className="text-[11px] text-slate-500 block">
                  {bookings.filter(b => b.status === 'completed').length} Completed Rides • Final Fare & OTP
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('completed')}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Completed Trips Sheet</span>
              </button>
            </div>

            {/* Pending Bookings */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">⏳ Pending Rides</span>
                <span className="text-[11px] text-slate-500 block">
                  {bookings.filter(b => b.status === 'pending').length} Unaccepted Requests • Live Orders
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('pending')}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pending Rides Sheet</span>
              </button>
            </div>

            {/* Payments */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">💳 Commission Payments</span>
                <span className="text-[11px] text-slate-500 block">
                  {payments.length} Records • Daily & Monthly Commission Receipts
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('payments')}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Payments Sheet</span>
              </button>
            </div>

            {/* Rates & Commissions */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 flex flex-col justify-between space-y-2.5">
              <div>
                <span className="text-xs font-black text-slate-900 block">🛺 Vehicle Rates Structure</span>
                <span className="text-[11px] text-slate-500 block">
                  {localCfg.vehicles.length} Vehicle Classes • KM Rates, Daily & Monthly
                </span>
              </div>
              <button
                onClick={() => handleExportExcel('rates')}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Rates & Commission Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
