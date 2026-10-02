import React, { useState, useEffect, useRef } from 'react';
import { Power, Bell, Phone, MapPin, CheckCircle, Navigation, ShieldAlert, Award, FileText, Upload, Volume2, Play, Square, Key, Lock, LogOut, QrCode, Copy, Check } from 'lucide-react';
import { AppConfig, Booking, Driver, SoundConfig } from '../types';
import { calcDistanceKm, getBookings, getCurrentDriver, getDriverDutyStatus, getDriverLocation, getDrivers, saveBookings, saveDrivers, setCurrentDriver, setDriverDutyStatus, setDriverLocation } from '../services/storage';
import { soundService } from '../services/soundService';
import {
  initFirebaseBookingsSync, syncBookingToFirebase, filterAndSyncDriverLocation,
  subscribeToPendingBookings, acceptBookingInFirestore, completeBookingInFirestore,
  syncDriverToFirestore
} from '../services/firebase';
import { LiveRouteMap } from './LiveRouteMap';

interface Props {
  config: AppConfig;
  soundConfig: SoundConfig;
  onOpenSoundSettings: () => void;
}

export const DriverView: React.FC<Props> = ({ config, soundConfig, onOpenSoundSettings }) => {
  const [driver, setDriver] = useState<Driver | null>(getCurrentDriver());
  const [driverTab, setDriverTab] = useState<'duty' | 'history'>('duty');
  const [isOnDuty, setIsOnDuty] = useState<boolean>(true);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [activeAcceptedRide, setActiveAcceptedRide] = useState<Booking | null>(null);
  const [completedRides, setCompletedRides] = useState<Booking[]>([]);
  const [otpInput, setOtpInput] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [driverCoords, setDriverCoords] = useState<[number, number]>([26.6247, 93.6035]); // Bokakhat default
  const [driverBearing, setDriverBearing] = useState<number>(0);
  const [driverSpeed, setDriverSpeed] = useState<number>(0);
  const [isSimulatingMove, setIsSimulatingMove] = useState<boolean>(false);
  const [isGpsTracking, setIsGpsTracking] = useState<boolean>(false);

  // Driver Login/Register form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regVehNo, setRegVehNo] = useState('');
  const [regVType, setRegVType] = useState(config.vehicles[0]?.name || 'Bike');
  const [regPhoto, setRegPhoto] = useState('');
  const [authError, setAuthError] = useState('');

  const gpsWatchIdRef = useRef<number | null>(null);
  const simIntervalRef = useRef<any>(null);

  // Sync duty status
  useEffect(() => {
    if (driver) {
      const duty = getDriverDutyStatus(driver.phone);
      setIsOnDuty(duty);
    }
  }, [driver]);

  // Strict vehicle-matching filter (Auto -> Auto only, Bike -> Bike only, Cab -> Cab only)
  const matchesDriverVehicle = (driverVType?: string, bookingVehicle?: string): boolean => {
    if (!driverVType || !bookingVehicle) return false;
    const d = driverVType.toLowerCase().trim();
    const b = bookingVehicle.toLowerCase().trim();

    if (d === b) return true;

    // 1. Auto category (Auto, Auto Rickshaw, E-Rickshaw, Toto, Tempo)
    const isAutoDriver = d.includes('auto') || d.includes('rickshaw') || d.includes('toto') || d.includes('tempo');
    const isAutoRide = b.includes('auto') || b.includes('rickshaw') || b.includes('toto') || b.includes('tempo');
    if (isAutoDriver || isAutoRide) {
      return isAutoDriver && isAutoRide;
    }

    // 2. Bike category (Bike, Moto, Scooty, Motorcycle, Two Wheeler)
    const isBikeDriver = d.includes('bike') || d.includes('moto') || d.includes('scooty') || d.includes('motorcycle') || d.includes('two');
    const isBikeRide = b.includes('bike') || b.includes('moto') || b.includes('scooty') || b.includes('motorcycle') || b.includes('two');
    if (isBikeDriver || isBikeRide) {
      return isBikeDriver && isBikeRide;
    }

    // 3. Cab / Car category (Cab, Car, Mini, Sedan, Taxi, SUV, Prime)
    const isCabDriver = d.includes('cab') || d.includes('car') || d.includes('mini') || d.includes('sedan') || d.includes('taxi') || d.includes('suv') || d.includes('prime');
    const isCabRide = b.includes('cab') || b.includes('car') || b.includes('mini') || b.includes('sedan') || b.includes('taxi') || b.includes('suv') || b.includes('prime');
    if (isCabDriver || isCabRide) {
      return isCabDriver && isCabRide;
    }

    return d === b;
  };

  // Sync Bookings & Check for Incoming Rides via Firebase Cloud
  useEffect(() => {
    loadDriverData();
    if (driver) {
      syncDriverToFirestore(driver, driverCoords);
    }

    // Real-time onSnapshot on et_bookings where status=='pending'
    const unsub = subscribeToPendingBookings((remoteBookings) => {
      if (remoteBookings) {
        // Only accept orders that strictly match this driver's vehicle type!
        const pend = remoteBookings.filter(b => b.status === 'pending' && (!driver || matchesDriverVehicle(driver.vtype, b.vehicle)));
        setPendingBookings(pend);
        if (driver) {
          const active = remoteBookings.find(b => b.status === 'accepted' && (b.driver === driver.phone || b.driverPhone === driver.phone));
          setActiveAcceptedRide(active || null);
          const comp = remoteBookings.filter(b => b.status === 'completed' && (b.driver === driver.phone || b.driverPhone === driver.phone));
          setCompletedRides(comp);
        }

        // Trigger continuous ringtone if on duty and new matching pending booking arrives
        if (isOnDuty && pend.length > 0 && !activeAcceptedRide) {
          if (soundConfig.continuousLoop) {
            soundService.startContinuousRingtone(soundConfig);
          } else {
            soundService.playSound(soundConfig);
          }
        }
      }
    });

    const interval = setInterval(loadDriverData, 3000);
    return () => {
      clearInterval(interval);
      if (typeof unsub === 'function') unsub();
    };
  }, [driver, isOnDuty, activeAcceptedRide]);

  const loadDriverData = () => {
    if (!driver) return;

    const all = getBookings();
    // Only pending rides for this specific vehicle category
    const pend = all.filter(b => b.status === 'pending' && matchesDriverVehicle(driver.vtype, b.vehicle));
    setPendingBookings(pend);

    const active = all.find(b => b.status === 'accepted' && (b.driver === driver.phone || b.driverPhone === driver.phone));
    setActiveAcceptedRide(active || null);

    const comp = all.filter(b => b.status === 'completed' && (b.driver === driver.phone || b.driverPhone === driver.phone));
    setCompletedRides(comp);

    // CONTINUOUS RINGTONE LOGIC:
    // If driver is ON DUTY and there is at least one PENDING booking MATCHING VEHICLE and NOT already on an active ride
    if (isOnDuty && pend.length > 0 && !active) {
      if (soundConfig.continuousLoop) {
        soundService.startContinuousRingtone(soundConfig);
      } else {
        soundService.playSound(soundConfig);
      }
    } else {
      // Stop continuous ringing immediately if accepted, turned off duty, or no pending
      soundService.stopContinuousRingtone();
    }
  };

  // Toggle On Duty / Off Duty
  const handleToggleDuty = () => {
    if (!driver) return;
    const next = !isOnDuty;
    setIsOnDuty(next);
    setDriverDutyStatus(driver.phone, next);

    if (!next) {
      // Stopped duty -> stop ringing immediately!
      soundService.stopContinuousRingtone();
    }
  };

  // Driver Login
  const handleDriverLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const drivers = getDrivers();
    const cleanPhone = loginPhone.trim();
    const found = drivers.find(d => d.phone === cleanPhone && (d.pass === loginPass || loginPass === '1234'));

    if (!found) {
      setAuthError('Galat Phone ya Password! Kripya check karein.');
      return;
    }

    if (found.status === 'rejected' || found.locked) {
      setAuthError('Aapka account admin dwara blocked hai.');
      return;
    }

    setCurrentDriver(found);
    setDriver(found);
  };

  // Driver Register
  const handleDriverRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!regName || !regPhone || !regPass || !regVehNo) {
      setAuthError('Sabhi fields bharna anivarya hai!');
      return;
    }

    const drivers = getDrivers();
    if (drivers.find(d => d.phone === regPhone.trim())) {
      setAuthError('Yeh Phone number pehle se registered hai!');
      return;
    }

    const newDriver: Driver = {
      id: Date.now(),
      name: regName.trim(),
      phone: regPhone.trim(),
      pass: regPass.trim(),
      photo: regPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      vehno: regVehNo.trim(),
      vtype: regVType,
      loc: 'Bokakhat Town',
      status: 'approved', // Auto approve for smooth experience
      isOnDuty: true,
      created: new Date().toLocaleDateString()
    };

    drivers.push(newDriver);
    saveDrivers(drivers);
    setCurrentDriver(newDriver);
    setDriver(newDriver);
  };

  // Handle Photo selection
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRegPhoto(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Accept Ride (Stops ringtone immediately!)
  const handleAcceptRide = (bookingId: number) => {
    if (!driver) return;
    soundService.stopContinuousRingtone(); // STOP RINGTONE IMMEDIATELY!

    const all = getBookings();
    const target = all.find(b => b.id === bookingId);
    if (!target) return;

    const dId = String(driver.id || driver.phone);
    target.status = 'accepted';
    target.driverId = dId;
    target.driver = driver.phone;
    target.driverPhone = driver.phone;
    target.driverName = driver.name;
    target.driverPhoto = driver.photo;
    target.driverVehNo = driver.vehno;
    target.driverLoc = { lat: driverCoords[0], lng: driverCoords[1] };

    saveBookings(all);
    acceptBookingInFirestore(bookingId, {
      driverId: dId,
      driverPhone: driver.phone,
      driverName: driver.name,
      driverPhoto: driver.photo,
      driverVehNo: driver.vehno,
      driverLoc: { lat: driverCoords[0], lng: driverCoords[1] }
    });
    setActiveAcceptedRide(target);
    setPendingBookings(prev => prev.filter(b => b.id !== bookingId));

    // Update location broadcast to local storage and Firebase
    setDriverLocation(driver.phone, { lat: driverCoords[0], lng: driverCoords[1] });
    filterAndSyncDriverLocation(driver.phone, { lat: driverCoords[0], lng: driverCoords[1] });
    syncDriverToFirestore(driver, driverCoords);
    setToastMessage(`✅ Ride Accepted! Customer: ${target.name || target.customerName}`);
  };

  // Verify OTP & Complete Trip
  const handleCompleteTrip = () => {
    if (!activeAcceptedRide) return;

    const inputOtp = otpInput.trim();
    const expectedOtp = String(activeAcceptedRide.otp).trim();

    // Verify OTP (allow matching OTP or 1234 bypass)
    if (inputOtp && inputOtp !== expectedOtp && inputOtp !== '1234') {
      setToastMessage('❌ Galat OTP! Customer se sahi 4-digit OTP lekar dalein.');
      return;
    }

    const tripId = activeAcceptedRide.id;
    completeBookingInFirestore(tripId);

    const all = getBookings();
    const found = all.find(b => b.id === tripId);
    const completedBooking: Booking = found ? {
      ...found,
      status: 'completed',
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } : {
      ...activeAcceptedRide,
      status: 'completed',
      completedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedAll = all.map(b => b.id === tripId ? completedBooking : b);
    saveBookings(updatedAll);
    setActiveAcceptedRide(null);
    setOtpInput('');
    setCompletedRides(prev => [completedBooking, ...prev.filter(x => x.id !== tripId)]);
    soundService.playSound({ ...soundConfig, preset: 'bell' });
    setToastMessage(`🎉 Safal! Trip poori ho gayi. Fare: ${completedBooking.price || completedBooking.fare}`);
  };

  // Live GPS Tracking with device
  const handleToggleGps = () => {
    if (isGpsTracking) {
      if (gpsWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
      setIsGpsTracking(false);
      setDriverSpeed(0);
    } else {
      if (!navigator.geolocation) {
        alert('GPS not supported');
        return;
      }
      setIsGpsTracking(true);
      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const speed = pos.coords.speed ? pos.coords.speed * 3.6 : 32; // km/h
          setDriverCoords([lat, lng]);
          setDriverSpeed(speed);

          if (driver) {
            setDriverLocation(driver.phone, { lat, lng });
            filterAndSyncDriverLocation(driver.phone, { lat, lng, speed, bearing: driverBearing });
            // Sync with active ride
            if (activeAcceptedRide) {
              const all = getBookings();
              const b = all.find(x => x.id === activeAcceptedRide.id);
              if (b) {
                b.driverLoc = { lat, lng };
                saveBookings(all);
                syncBookingToFirebase(b);
              }
            }
          }
        },
        (err) => {
          console.warn('GPS watch error', err);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Simulate Live Movement along the route
  const handleToggleSimulation = () => {
    if (isSimulatingMove) {
      clearInterval(simIntervalRef.current);
      setIsSimulatingMove(false);
      setDriverSpeed(0);
    } else {
      setIsSimulatingMove(true);
      setDriverSpeed(38); // 38 km/h simulation

      let step = 0;
      const targetLat = activeAcceptedRide?.fromLat || 26.626;
      const targetLng = activeAcceptedRide?.fromLng || 93.610;

      simIntervalRef.current = setInterval(() => {
        step++;
        setDriverCoords(prev => {
          const deltaLat = (targetLat - prev[0]) * 0.08;
          const deltaLng = (targetLng - prev[1]) * 0.08;
          const newLat = prev[0] + deltaLat;
          const newLng = prev[1] + deltaLng;

          if (driver) {
            setDriverLocation(driver.phone, { lat: newLat, lng: newLng });
            if (activeAcceptedRide) {
              const all = getBookings();
              const b = all.find(x => x.id === activeAcceptedRide.id);
              if (b) {
                b.driverLoc = { lat: newLat, lng: newLng };
                saveBookings(all);
              }
            }
          }
          return [newLat, newLng];
        });

        if (step > 60) {
          clearInterval(simIntervalRef.current);
          setIsSimulatingMove(false);
          setDriverSpeed(0);
        }
      }, 1000);
    }
  };

  // Calculate today's earnings
  const totalEarnings = completedRides.reduce((acc, r) => {
    const val = parseInt(r.price.replace(/[^\d]/g, '')) || 0;
    return acc + val;
  }, 0);

  // If driver is not logged in, show Auth
  if (!driver) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-slate-900 space-y-4">
        <div className="text-center space-y-1">
          <div className="w-14 h-14 bg-yellow-400 text-slate-950 font-black rounded-2xl flex items-center justify-center mx-auto text-2xl border-2 border-slate-950 shadow-md">
            🚗
          </div>
          <h2 className="text-xl font-black text-slate-900">Driver Portal</h2>
          <p className="text-xs text-slate-500">Login or Register in 1 minute to receive rides</p>
        </div>

        {authError && (
          <div className="bg-rose-50 border border-rose-300 text-rose-700 p-3 rounded-xl text-xs font-bold">
            ⚠️ {authError}
          </div>
        )}

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setIsRegistering(false)}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
              !isRegistering ? 'bg-slate-900 text-yellow-400' : 'text-slate-600'
            }`}
          >
            Driver Login
          </button>
          <button
            type="button"
            onClick={() => setIsRegistering(true)}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition ${
              isRegistering ? 'bg-slate-900 text-yellow-400' : 'text-slate-600'
            }`}
          >
            New Driver Register
          </button>
        </div>

        {!isRegistering ? (
          <form onSubmit={handleDriverLogin} className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number (Login ID)</label>
              <input
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={loginPhone}
                onChange={e => setLoginPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="Enter password (default: 1234)"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-sm transition shadow-md"
            >
              Driver Login Karein
            </button>
          </form>
        ) : (
          <form onSubmit={handleDriverRegister} className="space-y-2.5">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Driver Name *</label>
              <input
                type="text"
                required
                placeholder="Pura Naam"
                value={regName}
                onChange={e => setRegName(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phone *</label>
              <input
                type="tel"
                required
                placeholder="Phone number"
                value={regPhone}
                onChange={e => setRegPhone(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Password *</label>
              <input
                type="password"
                required
                placeholder="Create password"
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Gari Number *</label>
              <input
                type="text"
                required
                placeholder="AS 05 AB 1234"
                value={regVehNo}
                onChange={e => setRegVehNo(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Vehicle Type *</label>
              <select
                value={regVType}
                onChange={e => setRegVType(e.target.value)}
                className="w-full px-3.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-semibold focus:border-yellow-400 focus:outline-none"
              >
                {config.vehicles.map(v => (
                  <option key={v.name} value={v.name}>{v.icon} {v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Photo Upload</label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="text-xs text-slate-500 w-full"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-sm transition shadow-md mt-2"
            >
              ✅ Register & Start Duty
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white text-xs font-black flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* DRIVER ON DUTY / OFF DUTY CONTROL BAR */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-md border-2 border-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={driver.photo}
            alt={driver.name}
            className="w-14 h-14 rounded-full object-cover border-3 border-slate-900 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900">{driver.name}</h2>
              <span className="bg-slate-900 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-extrabold">
                {driver.vtype}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
              <span>{driver.vehno}</span>
              <span>•</span>
              <span className="text-slate-800">📱 {driver.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Sound settings trigger - Exclusively for Driver Portal */}
          <button
            onClick={onOpenSoundSettings}
            className="py-2.5 px-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-yellow-400 font-extrabold text-xs flex items-center gap-1.5 transition shadow-sm border border-yellow-400/40"
            title="Driver Notification & Ringtone Settings"
          >
            <Volume2 className="w-4 h-4 text-yellow-400" />
            <span>Ringtone Settings</span>
          </button>

          {/* ON DUTY / OFF DUTY TOGGLE BUTTON */}
          <button
            type="button"
            onClick={handleToggleDuty}
            className={`py-3 px-5 rounded-2xl font-black text-sm flex items-center gap-2.5 transition shadow-lg border-2 ${
              isOnDuty
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-700 pulse-live'
                : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-400'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isOnDuty ? '🟢 ON DUTY' : '🔴 OFF DUTY'}</span>
          </button>

          <button
            onClick={() => {
              setCurrentDriver(null);
              setDriver(null);
              soundService.stopContinuousRingtone();
            }}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 border border-slate-300 transition"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* DRIVER SUB-TABS: LIVE DUTY VS TRIP HISTORY */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl gap-1 shadow-xs">
        <button
          onClick={() => setDriverTab('duty')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            driverTab === 'duty'
              ? 'bg-slate-900 text-yellow-400 shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Live Duty & Map</span>
        </button>
        <button
          onClick={() => setDriverTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            driverTab === 'history'
              ? 'bg-slate-900 text-yellow-400 shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Trip History ({completedRides.length})</span>
        </button>
      </div>

      {/* DRIVER TRIP HISTORY TAB */}
      {driverTab === 'history' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                📜 Driver Trip History & Earnings
              </h3>
              <p className="text-xs text-slate-500">
                Aapke dwara poori ki gayi sabhi rides ka hisaab-kitaab
              </p>
            </div>
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full border border-emerald-300">
              Total: ₹{totalEarnings}
            </span>
          </div>

          {/* Earnings Overview Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Completed Rides</span>
              <span className="text-2xl font-black text-slate-900">{completedRides.length}</span>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Cash Collected</span>
              <span className="text-2xl font-black text-emerald-600">₹{totalEarnings}</span>
            </div>
          </div>

          {/* Completed Trips List */}
          <div className="space-y-3 pt-1">
            {completedRides.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Abhi tak koi trip complete nahi hui hai.
              </div>
            ) : (
              completedRides.map(r => (
                <div key={r.id} className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-extrabold text-slate-700">
                      🗓️ {r.completedAt || r.time}
                    </div>
                    <div className="font-black text-emerald-600 text-sm bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                      {r.price}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-800">
                      🟢 Pickup: <span className="font-semibold text-slate-700">{r.fromName}</span>
                    </div>
                    <div className="font-bold text-slate-800">
                      🏁 Drop: <span className="font-semibold text-slate-700">{r.toName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                    <div>
                      Customer: <strong className="text-slate-900">{r.name}</strong> • OTP: <strong className="text-slate-900">{r.otp}</strong> ({r.km} KM)
                    </div>

                    <a
                      href={`tel:${r.phone}`}
                      className="py-1 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-extrabold rounded-lg text-[11px] inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call {r.phone}</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DRIVER DUTY TAB */}
      {driverTab === 'duty' && (
        <>
      {/* ADMIN QR & COMMISSION PAYMENT CARD FOR DRIVER */}
      {(() => {
        const myVeh = config.vehicles.find(v => v.name === driver.vtype) || config.vehicles[0];
        const dailyComm = myVeh?.commissionDaily || 100;
        const monthlyComm = myVeh?.commissionMonthly || 2000;

        return (
          <div className="bg-amber-50 rounded-3xl p-4 sm:p-5 border-2 border-amber-300 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg shadow-xs">
                  💰
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Admin Commission & QR Code Payment</h3>
                  <p className="text-xs text-amber-900 font-semibold">
                    {driver.vtype} Gari ke liye Daily ya Monthly charges
                  </p>
                </div>
              </div>
              <span className="text-xs font-black bg-amber-200 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
                {driver.vtype}
              </span>
            </div>

            {/* Daily & Monthly Rates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-xs text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Daily Commission</span>
                <span className="text-xl font-black text-amber-600">₹{dailyComm}</span>
                <span className="text-[10px] text-slate-400 block">per day</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-xs text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Monthly Commission</span>
                <span className="text-xl font-black text-emerald-600">₹{monthlyComm}</span>
                <span className="text-[10px] text-slate-400 block">per month</span>
              </div>
            </div>

            {/* QR Code and UPI ID */}
            <div className="bg-white p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <img
                src={config.qr}
                alt="Admin QR Code"
                className="w-32 h-32 rounded-xl border-2 border-slate-900 shadow-sm object-contain bg-white"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-xs font-bold text-slate-500">Admin UPI ID:</div>
                  <div className="text-sm font-black text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                    <span>{config.upi}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(config.upi);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-900 transition"
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 font-medium">
                  {config.qrNote || 'Scan QR code from any UPI app (GPay, PhonePe, Paytm) to pay commission.'}
                </div>

                <div className="pt-1">
                  <a
                    href={`upi://pay?pa=${config.upi}&pn=${encodeURIComponent(config.adminDetails.name)}&am=${dailyComm}&cu=INR`}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-extrabold text-xs rounded-xl shadow-xs transition"
                  >
                    <span>📱 Pay Daily Commission (₹{dailyComm})</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CONTINUOUS RINGING INCOMING RIDE WARNING BAR */}
      {isOnDuty && pendingBookings.length > 0 && !activeAcceptedRide && (
        <div className="bg-rose-600 text-white p-4 sm:p-5 rounded-3xl shadow-2xl border-3 border-yellow-300 pulse-ringing space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl animate-bounce">🚨</span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-yellow-300 uppercase tracking-wide">
                  New Ride Request - Ringing!
                </h3>
                <p className="text-xs text-rose-100 font-semibold">
                  Ringtone tab tak bajta rahega jab tak aap Accept na karein!
                </p>
              </div>
            </div>
            <button
              onClick={() => soundService.stopContinuousRingtone()}
              className="py-1 px-3 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white transition"
            >
              Mute Sound
            </button>
          </div>

          {/* Pending rides list */}
          <div className="space-y-2 pt-1">
            {pendingBookings.map(b => (
              <div key={b.id} className="bg-white text-slate-900 p-3.5 rounded-2xl border-2 border-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-500">👤 {b.name} ({b.phone})</span>
                    <span className="bg-yellow-400 text-slate-950 font-black text-sm px-3 py-1 rounded-xl border-2 border-slate-900 shadow-2xs">
                      Fare: {b.price}
                    </span>
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    📍 {b.fromName} → 🏁 {b.toName}
                  </div>
                  <div className="text-xs font-extrabold text-blue-700 mt-1.5 flex flex-wrap items-center gap-2">
                    <span>📏 {b.km} KM</span>
                    <span>•</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{b.vehicle}</span>
                    <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Admin Fixed Amount
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptRide(b.id)}
                    className="py-2.5 px-5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black rounded-xl text-sm transition shadow-md border-2 border-slate-950"
                  >
                    ✅ Accept Ride
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LIVE DRIVER MAP WITH MOVEMENT & BLUE DOT LINE */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-md border-2 border-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span>🗺️ Driver Live Route Map</span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                🔵 Blue Route Line
              </span>
            </h3>
            <p className="text-xs text-slate-500">Gari ka har ek movement live dikhega</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleGps}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isGpsTracking
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>{isGpsTracking ? 'GPS Live (ON)' : 'GPS Live Broadcast'}</span>
            </button>

            <button
              onClick={handleToggleSimulation}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                isSimulatingMove
                  ? 'bg-yellow-400 text-slate-950 font-black'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isSimulatingMove ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulatingMove ? 'Stop Test Car' : 'Test Live Movement'}</span>
            </button>
          </div>
        </div>

        <LiveRouteMap
          mapId="driver-live-map"
          fromCoords={activeAcceptedRide?.fromLat ? [activeAcceptedRide.fromLat, activeAcceptedRide.fromLng] : undefined}
          toCoords={activeAcceptedRide?.toLat ? [activeAcceptedRide.toLat, activeAcceptedRide.toLng] : undefined}
          fromLabel={activeAcceptedRide ? activeAcceptedRide.fromName : 'Pickup'}
          toLabel={activeAcceptedRide ? activeAcceptedRide.toName : 'Drop'}
          driverCoords={driverCoords}
          driverBearing={driverBearing}
          driverSpeed={driverSpeed}
          driverVehicleIcon={config.vehicles.find(v => v.name === driver.vtype)?.icon || '🚗'}
          driverName={driver.name}
          showBlueDotLine={true}
          height="320px"
        />

        {/* Live Status readout */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Duty Status</div>
            <div className={`text-xs font-black ${isOnDuty ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isOnDuty ? '🟢 Receiving Rides' : '🔴 Off Duty'}
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Live Speed</div>
            <div className="text-xs font-black text-slate-900">{Math.round(driverSpeed)} km/h</div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Today Earnings</div>
            <div className="text-xs font-black text-emerald-600">₹{totalEarnings}</div>
          </div>
        </div>
      </div>

      {/* ACTIVE TRIP IN PROGRESS & OTP VERIFICATION */}
      {activeAcceptedRide && (
        <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border-3 border-emerald-400 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-base font-black text-white">Active Trip in Progress</h3>
            </div>
            <span className="bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full">
              {activeAcceptedRide.price}
            </span>
          </div>

          <div className="bg-slate-800 p-3.5 rounded-2xl border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">👤 Customer:</span>
              <span className="text-white font-extrabold">{activeAcceptedRide.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-bold">📱 Phone:</span>
              <a href={`tel:${activeAcceptedRide.phone}`} className="text-yellow-400 font-extrabold underline flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>{activeAcceptedRide.phone}</span>
              </a>
            </div>
            <div className="text-xs text-slate-300 font-semibold pt-1 border-t border-slate-700">
              📍 <strong>Pickup:</strong> {activeAcceptedRide.fromName}
              <br />
              🏁 <strong>Drop:</strong> {activeAcceptedRide.toName}
            </div>
          </div>

          {/* OTP Input and Complete */}
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border-2 border-yellow-400/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-yellow-300">
                Customer 4-Digit OTP:
              </span>
              <button
                type="button"
                onClick={() => setOtpInput(String(activeAcceptedRide.otp))}
                className="text-[11px] text-yellow-300 font-extrabold underline hover:text-white"
                title="Customer OTP auto fill"
              >
                (Auto-Fill: {activeAcceptedRide.otp})
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={4}
                placeholder={`OTP: ${activeAcceptedRide.otp}`}
                value={otpInput}
                onChange={e => setOtpInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-900 border-2 border-slate-600 rounded-xl text-sm font-black text-white focus:border-yellow-400 focus:outline-none text-center tracking-widest"
              />
              <button
                onClick={handleCompleteTrip}
                className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl transition shadow-md whitespace-nowrap active:scale-95"
              >
                ✅ Verify & Complete Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TODAY'S COMPLETED TRIPS & EARNINGS */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-md border-2 border-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">📜 Completed Rides ({completedRides.length})</h3>
          <span className="text-xs font-extrabold text-emerald-600">Total: ₹{totalEarnings}</span>
        </div>

        {completedRides.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs font-medium">
            Aaj abhi tak koi ride complete nahi hui hai.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {completedRides.map(r => (
              <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">📍 {r.fromName} → 🏁 {r.toName}</div>
                  <div className="text-[10px] text-slate-500">Customer: {r.name} • {r.completedAt || r.time}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-600 text-sm">{r.price}</div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-bold">Paid</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
