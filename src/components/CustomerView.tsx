import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, User, CheckCircle, RefreshCw, History, Car, ArrowRight, ShieldCheck, Clock, ExternalLink, Gift, Share2, Copy, Check, Sparkles, X } from 'lucide-react';
import { AppConfig, Booking, CustomerUser, VehicleConfig, ReferralData } from '../types';
import { ASSAM_LOCATIONS, calcDistanceKm, getBookings, saveBookings, getDrivers, getReferralData, saveReferralData, applyReferralCode, deductWalletBalance, generateReferralCode } from '../services/storage';
import {
  initFirebaseBookingsSync, syncBookingToFirebase, listenToDriverLiveLocation,
  getCustomerTripsFromFirestore, saveBookingToFirestore, cancelBookingInFirestore,
  subscribeToAllBookings, syncReferralToFirestore
} from '../services/firebase';
import { LiveRouteMap } from './LiveRouteMap';

interface Props {
  config: AppConfig;
  currentCustomer: CustomerUser | null;
  onOpenCustomerAuth: () => void;
}

export const CustomerView: React.FC<Props> = ({ config, currentCustomer, onOpenCustomerAuth }) => {
  const [customerTab, setCustomerTab] = useState<'book' | 'history'>('book');
  const [firestoreTrips, setFirestoreTrips] = useState<Booking[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [fromCoords, setFromCoords] = useState<[number, number] | null>(null);
  const [toCoords, setToCoords] = useState<[number, number] | null>(null);
  const [suggestFrom, setSuggestFrom] = useState<string[]>([]);
  const [suggestTo, setSuggestTo] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState('0.00');
  const [selectedVehicle, setSelectedVehicle] = useState<string>(config.vehicles[0]?.name || 'Bike');
  const [calculatedPrice, setCalculatedPrice] = useState(50);
  const [phone, setPhone] = useState(currentCustomer?.phone || '');
  const [name, setName] = useState(currentCustomer?.name || '');
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [bookingHistory, setBookingHistory] = useState<Booking[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [appliedReferralCode, setAppliedReferralCode] = useState('');
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralMessage, setReferralMessage] = useState('');
  const [useWalletBonus, setUseWalletBonus] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [clickStep, setClickStep] = useState<'from' | 'to'>('from');

  // Check URL query parameters for ?ref= promo links
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode) {
        setReferralInput(refCode.toUpperCase());
        setReferralMessage(`🎁 ৰেফাৰেল ক'ড ${refCode.toUpperCase()} চিনাক্ত হ'ল! প্ৰথম বুকিংত ₹25 ৰেহাই পাব।`);
      }
    } catch (e) {}
  }, []);

  const loadFirestoreHistory = async () => {
    setIsLoadingFirestore(true);
    try {
      const activePhone = phone.trim() || currentCustomer?.phone?.trim();
      const trips = await getCustomerTripsFromFirestore(activePhone);
      if (trips && trips.length > 0) {
        setFirestoreTrips(trips);
      }
    } catch (e) {
      console.warn('Firestore history load notice:', e);
    }
    setIsLoadingFirestore(false);
  };

  useEffect(() => {
    if (customerTab === 'history') {
      loadFirestoreHistory();
    }
  }, [customerTab, phone, currentCustomer]);

  // Sync customer details when logged in
  useEffect(() => {
    if (currentCustomer) {
      if (!name) setName(currentCustomer.name);
      if (!phone) setPhone(currentCustomer.phone);
    }
  }, [currentCustomer]);

  // Load existing active booking & connect Firebase realtime cloud sync
  useEffect(() => {
    loadBookingsState();
    const unsub = subscribeToAllBookings((remoteBookings) => {
      if (remoteBookings && remoteBookings.length > 0) {
        const activeId = sessionStorage.getItem('et_active_booking_id') || localStorage.getItem('et_active_booking_id');
        if (activeId) {
          const match = remoteBookings.find(b => String(b.id) === String(activeId));
          if (match) {
            if (match.status === 'cancelled') {
              setActiveBooking(null);
              sessionStorage.removeItem('et_active_booking_id');
              localStorage.removeItem('et_active_booking_id');
            } else {
              setActiveBooking(match);
            }
            return;
          }
        }

        if (phone) {
          const myBookings = remoteBookings.filter(b => b.phone === phone);
          setBookingHistory(myBookings);
          const active = myBookings.find(b => b.status === 'new' || b.status === 'pending' || b.status === 'accepted');
          if (active) {
            setActiveBooking(active);
            sessionStorage.setItem('et_active_booking_id', String(active.id));
            if (!fromCoords && active.fromLat) setFromCoords([active.fromLat, active.fromLng]);
            if (!toCoords && active.toLat) setToCoords([active.toLat, active.toLng]);
          }
        }
      }
    });

    const interval = setInterval(loadBookingsState, 3000);
    return () => {
      clearInterval(interval);
      if (typeof unsub === 'function') unsub();
    };
  }, [phone]);

  // Listen to Driver's real-time cloud location from Firebase
  useEffect(() => {
    if (activeBooking && activeBooking.status === 'accepted' && activeBooking.driver) {
      const unsub = listenToDriverLiveLocation(activeBooking.driver, (loc) => {
        if (loc && loc.lat && loc.lng) {
          setActiveBooking(prev => prev ? { ...prev, driverLoc: { lat: loc.lat, lng: loc.lng } } : null);
        }
      });
      return () => unsub();
    }
  }, [activeBooking?.driver, activeBooking?.status]);

  const loadBookingsState = () => {
    const all = getBookings();
    const activeId = sessionStorage.getItem('et_active_booking_id') || localStorage.getItem('et_active_booking_id');

    if (activeId) {
      const myActive = all.find(b => String(b.id) === String(activeId) && b.status !== 'cancelled');
      if (myActive) {
        setActiveBooking(myActive);
        if (!fromCoords && myActive.fromLat) setFromCoords([myActive.fromLat, myActive.fromLng]);
        if (!toCoords && myActive.toLat) setToCoords([myActive.toLat, myActive.toLng]);
        return;
      }
    }

    if (phone) {
      const myBookings = all.filter(b => b.phone === phone);
      setBookingHistory(myBookings);
      const active = myBookings.find(b => b.status === 'pending' || b.status === 'accepted');
      if (active) {
        setActiveBooking(active);
        sessionStorage.setItem('et_active_booking_id', String(active.id));
        if (!fromCoords && active.fromLat) setFromCoords([active.fromLat, active.fromLng]);
        if (!toCoords && active.toLat) setToCoords([active.toLat, active.toLng]);
      } else if (activeBooking && activeBooking.status === 'accepted') {
        const completed = myBookings.find(b => b.id === activeBooking.id && b.status === 'completed');
        if (completed) setActiveBooking(completed);
      }
    }
  };

  // Recalculate distance and price
  useEffect(() => {
    if (fromCoords && toCoords) {
      const dist = calcDistanceKm(fromCoords[0], fromCoords[1], toCoords[0], toCoords[1]);
      const kmFormatted = dist < 0.1 ? '1.0' : dist.toFixed(1);
      setDistanceKm(kmFormatted);

      const veh = config.vehicles.find(v => v.name === selectedVehicle) || config.vehicles[0];
      const rate = veh ? veh.rate : 15;
      const baseFare = config.baseFare ?? 40;
      const total = Math.round(parseFloat(kmFormatted) * rate + baseFare);
      setCalculatedPrice(total);
    }
  }, [fromCoords, toCoords, selectedVehicle, config.vehicles, config.baseFare]);

  // Handle Location Search Input
  const handleFromSearch = (val: string) => {
    setFromLocation(val);
    if (!val.trim()) {
      setSuggestFrom([]);
      return;
    }
    const matches = Object.keys(ASSAM_LOCATIONS).filter(k =>
      k.toLowerCase().includes(val.toLowerCase())
    );
    setSuggestFrom(matches);
  };

  const handleToSearch = (val: string) => {
    setToLocation(val);
    if (!val.trim()) {
      setSuggestTo([]);
      return;
    }
    const matches = Object.keys(ASSAM_LOCATIONS).filter(k =>
      k.toLowerCase().includes(val.toLowerCase())
    );
    setSuggestTo(matches);
  };

  const selectFromLocation = (locName: string) => {
    const coords = ASSAM_LOCATIONS[locName];
    if (coords) {
      setFromLocation(locName);
      setFromCoords(coords);
      setSuggestFrom([]);
      setClickStep('to'); // Auto switch to setting Drop next
    }
  };

  const selectToLocation = (locName: string) => {
    const coords = ASSAM_LOCATIONS[locName];
    if (coords) {
      setToLocation(locName);
      setToCoords(coords);
      setSuggestTo([]);
      setClickStep('to');
    }
  };

  // GPS Location handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('GPS is not supported on this device');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setFromCoords([lat, lng]);
        setFromLocation(`My GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
        setClickStep('to'); // Immediately prepare to pick Drop location!
      },
      (err) => {
        setIsLocating(false);
        // Fallback to Bokakhat
        setFromCoords(ASSAM_LOCATIONS['Bokakhat Town']);
        setFromLocation('Bokakhat Town (Assam)');
        setClickStep('to');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Map Click handler (toggle between setting From and To)
  const handleMapClick = (coords: [number, number]) => {
    if (clickStep === 'from' || !fromCoords) {
      setFromCoords(coords);
      setFromLocation(`Pickup Map Point (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`);
      setClickStep('to'); // Prompt user for Drop next
    } else {
      setToCoords(coords);
      setToLocation(`Drop Map Point (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`);
    }
  };

  // Active user referral info
  const myRefData = getReferralData(phone || currentCustomer?.phone || '8638803320', name || currentCustomer?.name || 'Customer');

  // Apply Referral Code handler
  const handleApplyReferral = () => {
    if (!referralInput.trim()) {
      setReferralMessage('Please enter a referral code');
      return;
    }
    const cleanP = phone.trim() || currentCustomer?.phone?.trim() || '8638803320';
    const res = applyReferralCode(referralInput, cleanP, name || 'Customer');
    if (res.success) {
      setAppliedReferralCode(res.referrerCode || referralInput.trim().toUpperCase());
      setReferralDiscount(res.discount);
      setReferralMessage(res.message);
      if (res.referrerCode) {
        const ownerData = getReferralData(res.referrerCode);
        syncReferralToFirestore(ownerData);
      }
    } else {
      setReferralMessage(res.message);
    }
  };

  // Create Ride Booking
  const handleCreateBooking = () => {
    if (!fromCoords || !toCoords || !fromLocation || !toLocation) {
      alert('Please select both Pickup (From) and Drop (To) locations!');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    if (!cleanPhone || !cleanName) {
      alert('Customer Name and Phone Number are required to book!');
      return;
    }

    // Calculate effective price with referral / wallet bonus
    let totalDiscount = 0;
    if (referralDiscount > 0) {
      totalDiscount += referralDiscount;
    }
    if (useWalletBonus && myRefData.walletBalance > 0) {
      const walletUsed = Math.min(25, myRefData.walletBalance);
      totalDiscount += walletUsed;
      deductWalletBalance(cleanPhone, walletUsed);
    }

    const effectiveFare = Math.max(10, calculatedPrice - totalDiscount);
    const otp = Math.floor(1000 + Math.random() * 9000);
    const mapLink = `https://www.google.com/maps/dir/?api=1&origin=${fromCoords[0]},${fromCoords[1]}&destination=${toCoords[0]},${toCoords[1]}`;
    const newBooking: Booking = {
      id: Date.now(),
      customerName: cleanName,
      name: cleanName,
      phone: cleanPhone,
      pickup: fromLocation,
      from: fromLocation,
      fromName: fromLocation,
      drop: toLocation,
      to: toLocation,
      toName: toLocation,
      fromLat: fromCoords[0],
      fromLng: fromCoords[1],
      toLat: toCoords[0],
      toLng: toCoords[1],
      googleMapLink: mapLink,
      km: distanceKm,
      fare: `₹${effectiveFare}`,
      price: `₹${effectiveFare}`,
      vehicle: selectedVehicle,
      otp: otp,
      status: 'new',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      referralCode: appliedReferralCode || undefined,
      discount: totalDiscount > 0 ? totalDiscount : undefined
    };

    const all = getBookings();
    all.unshift(newBooking);
    saveBookings(all);
    saveBookingToFirestore(newBooking);
    sessionStorage.setItem('et_active_booking_id', String(newBooking.id));
    localStorage.setItem('et_active_booking_id', String(newBooking.id));
    setActiveBooking(newBooking);
    setBookingHistory(prev => [newBooking, ...prev]);

    // Scroll to tracking section
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  // Cancel or Clear Booking
  const handleClearBooking = () => {
    if (activeBooking) {
      cancelBookingInFirestore(activeBooking.id);
      const all = getBookings().filter(b => b.id !== activeBooking.id);
      saveBookings(all);
    }
    sessionStorage.removeItem('et_active_booking_id');
    localStorage.removeItem('et_active_booking_id');
    setActiveBooking(null);
    setFromCoords(null);
    setToCoords(null);
    setFromLocation('');
    setToLocation('');
    setDistanceKm('0.00');
    setCalculatedPrice(0);
  };

  // Find Driver details if accepted
  const assignedDriver = activeBooking?.driver
    ? getDrivers().find(d => d.phone === activeBooking.driver)
    : null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-10">
      {/* Customer Login / Profile Quick Banner */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border-2 border-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-lg border-2 border-slate-950 shadow-xs">
            {currentCustomer ? currentCustomer.name.charAt(0).toUpperCase() : '👤'}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Customer Portal</div>
            <div className="text-sm font-extrabold text-slate-900">
              {currentCustomer ? `${currentCustomer.name} (${currentCustomer.phone})` : 'Guest Mode (No Login)'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {bookingHistory.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 border border-slate-300 transition"
            >
              <History className="w-3.5 h-3.5" />
              <span>Rides ({bookingHistory.length})</span>
            </button>
          )}

          <button
            onClick={onOpenCustomerAuth}
            className={`py-1.5 px-3.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-xs ${
              currentCustomer
                ? 'bg-slate-900 text-yellow-400 hover:bg-slate-800'
                : 'bg-yellow-400 text-slate-950 hover:bg-yellow-500 border border-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{currentCustomer ? 'Profile / Logout' : 'Customer Login'}</span>
          </button>
        </div>
      </div>

      {/* Customer Sub-Tabs: Book Ride vs Trip History */}
      <div className="flex bg-slate-200 p-1.5 rounded-2xl gap-1 shadow-xs">
        <button
          onClick={() => setCustomerTab('book')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            customerTab === 'book'
              ? 'bg-slate-900 text-yellow-400 shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>📍 Book Ride</span>
        </button>
        <button
          onClick={() => setCustomerTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
            customerTab === 'history'
              ? 'bg-slate-900 text-yellow-400 shadow-md'
              : 'text-slate-700 hover:text-slate-950'
          }`}
        >
          <History className="w-4 h-4" />
          <span>📜 Trip History</span>
          {(bookingHistory.filter(b => b.status === 'completed').length > 0 || firestoreTrips.length > 0) && (
            <span className="bg-yellow-400 text-slate-950 text-[10px] px-2 py-0.2 rounded-full font-black">
              {Math.max(bookingHistory.filter(b => b.status === 'completed').length, firestoreTrips.length)}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: TRIP HISTORY VIEW (STORED IN FIRESTORE) */}
      {customerTab === 'history' && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>📜 Customer Trip History</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                  Firestore Cloud Sync
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pichhli sabhi completed rides ka record (Date, Fare, Pickup/Drop & Driver details)
              </p>
            </div>
            <button
              onClick={loadFirestoreHistory}
              disabled={isLoadingFirestore}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Refresh from Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingFirestore ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* List of Previous Ride Completions */}
          {(() => {
            // Merge Firestore trips and local bookings (completed only)
            const map = new Map<number, Booking>();
            firestoreTrips.forEach(t => map.set(Number(t.id), t));
            bookingHistory
              .filter(b => b.status === 'completed')
              .forEach(b => {
                if (!map.has(Number(b.id))) map.set(Number(b.id), b);
              });
            const mergedCompleted = Array.from(map.values()).sort((a, b) => Number(b.id) - Number(a.id));

            if (mergedCompleted.length === 0) {
              return (
                <div className="text-center py-12 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-3xl mx-auto">
                    📜
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Koi Completed Trip Nahi Mili</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Aapki pichhli rides complete hone par unki date, fare aur pickup/drop details Firestore me save hokar yaha dikhengi.
                    </p>
                  </div>
                  <button
                    onClick={() => setCustomerTab('book')}
                    className="py-2.5 px-5 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-xs rounded-xl transition shadow-xs"
                  >
                    + Book Your First Ride
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {mergedCompleted.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-400 transition-all space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-700">
                          🗓️ {t.completedAt || t.time}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                          ✓ Completed
                        </span>
                      </div>
                      <div className="text-base font-black text-slate-900 bg-yellow-400/30 px-2.5 py-0.5 rounded-lg border border-yellow-400/50">
                        {t.price}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold mt-0.5">🟢 Pickup:</span>
                        <span className="font-bold text-slate-900">{t.fromName}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-rose-600 font-bold mt-0.5">🏁 Drop:</span>
                        <span className="font-bold text-slate-900">{t.toName}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>Vehicle: <strong className="text-slate-800">{t.vehicle}</strong> ({t.km} KM)</span>
                        {t.driverName && (
                          <span>Driver: <strong className="text-slate-800">{t.driverName}</strong></span>
                        )}
                        <span>OTP: <strong className="text-slate-800">{t.otp}</strong></span>
                      </div>

                      <button
                        onClick={() => {
                          setFromLocation(t.fromName);
                          setToLocation(t.toName);
                          if (t.fromLat) setFromCoords([t.fromLat, t.fromLng]);
                          if (t.toLat) setToCoords([t.toLat, t.toLng]);
                          setSelectedVehicle(t.vehicle);
                          setCustomerTab('book');
                        }}
                        className="py-1 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-[11px] rounded-lg transition"
                      >
                        🔁 Book Again
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: BOOKING FLOW & MAP (ONLY ONE MAP AT A TIME) */}
      {customerTab === 'book' && (
        <>
          {/* ACTIVE RIDE / TRACKING CARD */}
          {activeBooking ? (
            <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 border-3 border-yellow-400 shadow-xl space-y-4 animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
              <h3 className="text-base sm:text-lg font-black text-yellow-400">
                {activeBooking.status === 'pending'
                  ? '🔍 Driver Dhundh Rahe Hain...'
                  : activeBooking.status === 'accepted'
                  ? '🚖 Driver On The Way (Live Map)'
                  : '✅ Ride Completed!'}
              </h3>
            </div>
            <div className="bg-yellow-400 text-slate-950 px-3 py-1 rounded-full text-xs font-black">
              OTP: {activeBooking.otp}
            </div>
          </div>

          {/* Assigned Driver Card */}
          {assignedDriver && activeBooking.status === 'accepted' && (
            <div className="bg-slate-800/90 border-2 border-yellow-400/80 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={assignedDriver.photo}
                  alt={assignedDriver.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-yellow-400"
                />
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>{assignedDriver.name}</span>
                    <span className="text-xs bg-yellow-400 text-slate-950 px-1.5 py-0.2 rounded font-bold">
                      {assignedDriver.vtype}
                    </span>
                  </div>
                  <div className="text-xs text-yellow-300 font-bold">{assignedDriver.vehno}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">⭐ 4.9 • Verified Driver</div>
                </div>
              </div>
              <a
                href={`tel:${assignedDriver.phone}`}
                className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Driver</span>
              </a>
            </div>
          )}

          {/* LIVE TRIP MAP WITH BLUE DOT LINE */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-yellow-400">
                <span>🔵 Blue Dotted Line Active</span>
              </span>
              <span className="text-[10px] text-slate-400">Real-time GPS Tracking</span>
            </div>

            <LiveRouteMap
              mapId="customer-active-map"
              fromCoords={activeBooking.fromLat ? [activeBooking.fromLat, activeBooking.fromLng] : fromCoords}
              toCoords={activeBooking.toLat ? [activeBooking.toLat, activeBooking.toLng] : toCoords}
              fromLabel={activeBooking.fromName}
              toLabel={activeBooking.toName}
              driverCoords={activeBooking.driverLoc ? [activeBooking.driverLoc.lat, activeBooking.driverLoc.lng] : undefined}
              driverName={assignedDriver?.name}
              driverVehicleIcon={config.vehicles.find(v => v.name === activeBooking.vehicle)?.icon || '🚗'}
              showBlueDotLine={true}
              height="300px"
            />
          </div>

          {/* Ride Details & OTP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Pickup</div>
              <div className="text-xs font-bold text-white truncate">{activeBooking.fromName}</div>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Drop</div>
              <div className="text-xs font-bold text-white truncate">{activeBooking.toName}</div>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Fare</div>
              <div className="text-xs font-black text-yellow-400">{activeBooking.price}</div>
            </div>
            <div className="bg-emerald-950/80 p-2.5 rounded-xl border border-emerald-500">
              <div className="text-[10px] text-emerald-300 font-bold uppercase">Share OTP</div>
              <div className="text-sm font-black text-emerald-400">{activeBooking.otp}</div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleClearBooking}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cancel / Naya Ride Book Karein</span>
            </button>
          </div>
        </div>
      ) : (
        /* MAIN BOOKING FORM (ONLY ONE MAP SHOWN) */
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-md border-2 border-slate-900 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              {config.design.texts.customerHead || '📍 Book Your Ride - Assam'}
            </h2>
            <p className="text-xs text-slate-500">Live Easy Trip Map • Fast Pickup • Transparent Fare</p>
          </div>
          <span className="text-2xl">🚖</span>
        </div>

        {/* EASY TRIP MAP SELECTION PREVIEW WITH BLUE DOT LINE */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>🗺️ Live Route Map & Blue Dot Line</span>
            </span>

            {/* Click Mode Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300 shadow-2xs">
              <button
                type="button"
                onClick={() => setClickStep('from')}
                className={`py-1 px-3 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                  clickStep === 'from'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
                }`}
              >
                <span>🟢 1. Pickup Point</span>
                {fromCoords && <span className="text-[10px] bg-emerald-800 text-white px-1 rounded">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => setClickStep('to')}
                className={`py-1 px-3 rounded-lg text-xs font-black transition flex items-center gap-1.5 ${
                  clickStep === 'to'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200'
                }`}
              >
                <span>🏁 2. Drop Point</span>
                {toCoords && <span className="text-[10px] bg-rose-800 text-white px-1 rounded">✓</span>}
              </button>
            </div>
          </div>

          <div className="mb-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
            <span className="font-bold text-blue-900">
              {clickStep === 'from'
                ? '👉 Map par Pickup location par tap karein'
                : '👉 Map par Drop (manzil) location par tap karein'}
            </span>
            <span className="text-[11px] font-semibold text-blue-700">
              {clickStep === 'to' ? '🎯 Drop Mode Active' : '📍 Pickup Mode Active'}
            </span>
          </div>

          <LiveRouteMap
            mapId="customer-picker-map"
            fromCoords={fromCoords}
            toCoords={toCoords}
            fromLabel="Pickup"
            toLabel="Drop"
            showBlueDotLine={true}
            onMapClick={handleMapClick}
            height="270px"
          />
        </div>

        {/* Quick Location Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating GPS...' : config.design.texts.currentBtn || '📍 My Location'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFromCoords(null);
              setToCoords(null);
              setFromLocation('');
              setToLocation('');
              setClickStep('from');
            }}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-yellow-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset / Re-Click Map</span>
          </button>
        </div>

        {/* Popular Preset Places in Assam */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Quick Assam Locations
          </label>
          <div className="flex flex-wrap gap-1.5">
            {['Bokakhat Town', 'Kaziranga Kohora', 'Numaligarh Town', 'Golaghat Town', 'Dergaon'].map(loc => (
              <button
                key={loc}
                type="button"
                onClick={() => {
                  if (!fromCoords) selectFromLocation(loc);
                  else selectToLocation(loc);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-yellow-100 text-slate-800 hover:text-slate-950 text-xs font-semibold border border-slate-200 transition"
              >
                + {loc}
              </button>
            ))}
          </div>
        </div>

        {/* FROM INPUT WITH AUTOCOMPLETE */}
        <div className="relative">
          <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>From (Pickup Location) *</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="From: Bokakhat Town, Market, GPS..."
              value={fromLocation}
              onFocus={() => setClickStep('from')}
              onChange={(e) => handleFromSearch(e.target.value)}
              className="w-full pl-3.5 pr-10 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
            {fromCoords && (
              <span className="absolute right-3 top-3 text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                ✓ Set
              </span>
            )}
          </div>
          {suggestFrom.length > 0 && (
            <div className="absolute z-[100] left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border-2 border-slate-900 max-h-48 overflow-y-auto">
              {suggestFrom.map(loc => (
                <div
                  key={loc}
                  onClick={() => selectFromLocation(loc)}
                  className="p-2.5 hover:bg-yellow-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-100 flex items-center justify-between"
                >
                  <span>📍 {loc}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Select</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TO INPUT WITH AUTOCOMPLETE */}
        <div className="relative">
          <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>To (Drop Location) *</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="To: Golaghat, Kaziranga, Dergaon..."
              value={toLocation}
              onFocus={() => setClickStep('to')}
              onChange={(e) => handleToSearch(e.target.value)}
              className="w-full pl-3.5 pr-10 py-3 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
            {toCoords && (
              <span className="absolute right-3 top-3 text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold">
                ✓ Set
              </span>
            )}
          </div>
          {suggestTo.length > 0 && (
            <div className="absolute z-[100] left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border-2 border-slate-900 max-h-48 overflow-y-auto">
              {suggestTo.map(loc => (
                <div
                  key={loc}
                  onClick={() => selectToLocation(loc)}
                  className="p-2.5 hover:bg-yellow-50 cursor-pointer text-xs font-bold text-slate-800 border-b border-slate-100 flex items-center justify-between"
                >
                  <span>🏁 {loc}</span>
                  <span className="text-[10px] text-rose-600 font-bold">Select</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* VEHICLE SELECTION CAROUSEL / GRID */}
        <div>
          <label className="text-xs font-extrabold text-slate-700 block mb-2">
            Select Ride Type
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {config.vehicles.map((v) => {
              const isSelected = selectedVehicle === v.name;
              return (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => setSelectedVehicle(v.name)}
                  className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                    isSelected
                      ? 'border-yellow-500 bg-yellow-400/20 shadow-md ring-2 ring-yellow-400'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-2xl mb-1">{v.icon}</span>
                  <span className="text-xs font-bold text-slate-900">{v.name}</span>
                  <span className="text-[10px] font-semibold text-slate-500">₹{v.rate}/km</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* REFERRAL & PROMO DISCOUNT SECTION */}
        <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border-2 border-yellow-300 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black text-slate-900">Referral / Promo Code</span>
            </div>
            <button
              type="button"
              onClick={() => setShowReferralModal(true)}
              className="text-[11px] font-extrabold text-blue-700 hover:underline flex items-center gap-1"
            >
              <span>🎁 Refer & Earn ₹50</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. YATRA-8638"
              value={referralInput}
              onChange={e => setReferralInput(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded-xl text-xs font-bold uppercase placeholder-slate-400 focus:outline-none focus:border-yellow-500"
            />
            <button
              type="button"
              onClick={handleApplyReferral}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-xl shadow-xs transition"
            >
              {appliedReferralCode ? '✓ Applied' : 'Apply (₹25 Off)'}
            </button>
          </div>

          {referralMessage && (
            <div className={`text-xs font-bold p-2 rounded-lg ${referralDiscount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {referralMessage}
            </div>
          )}

          {/* Wallet Balance Usage */}
          {myRefData.walletBalance > 0 && (
            <div className="flex items-center justify-between pt-1 text-xs border-t border-yellow-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-extrabold text-slate-800">
                  Your Referral Wallet Balance: <strong className="text-emerald-700">₹{myRefData.walletBalance}</strong>
                </span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-900">
                <input
                  type="checkbox"
                  checked={useWalletBonus}
                  onChange={e => setUseWalletBonus(e.target.checked)}
                  className="rounded text-yellow-500 focus:ring-yellow-400"
                />
                <span>২৫ টকা ব্যৱহাৰ কৰক</span>
              </label>
            </div>
          )}
        </div>

        {/* ESTIMATED FARE BANNER - ADMIN FIXED CALCULATION */}
        <div className="bg-slate-900 text-yellow-400 p-4 rounded-2xl flex items-center justify-between shadow-md border-2 border-yellow-400/40">
          <div>
            <div className="text-[10px] font-extrabold tracking-wider uppercase text-yellow-400/80">
              নিৰ্ধাৰিত মূল্য: {selectedVehicle} @ ₹{config.vehicles.find(v => v.name === selectedVehicle)?.rate || 15}/KM
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{distanceKm} KM</span>
              <span className="text-slate-500">•</span>
              <span className="text-yellow-400">{selectedVehicle}</span>
              {(referralDiscount > 0 || useWalletBonus) && (
                <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500">
                  -₹{(referralDiscount || 0) + (useWalletBonus ? 25 : 0)} ৰেহাই!
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {(referralDiscount > 0 || useWalletBonus) && (
              <div className="text-xs line-through text-slate-400 font-bold">
                ₹{calculatedPrice}
              </div>
            )}
            <div className="text-2xl sm:text-3xl font-black text-yellow-400">
              ₹{Math.max(10, calculatedPrice - (referralDiscount || 0) - (useWalletBonus ? Math.min(25, myRefData.walletBalance) : 0))}
            </div>
            <div className="text-[10px] text-emerald-400 font-extrabold">
              ✓ সুৰক্ষিত যাত্ৰা • Fix Fare
            </div>
          </div>
        </div>

        {/* CUSTOMER CONTACT DETAILS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Customer Phone *</label>
            <input
              type="tel"
              required
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">Customer Name *</label>
            <input
              type="text"
              required
              placeholder="Aapka Naam"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-semibold focus:border-yellow-400 focus:outline-none"
            />
          </div>
        </div>

        {/* BOOK BUTTON */}
        <button
          type="button"
          onClick={handleCreateBooking}
          className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black text-base rounded-2xl transition shadow-lg flex items-center justify-center gap-2 border-2 border-slate-950 active:scale-[0.99]"
        >
          <Car className="w-5 h-5" />
          <span>{config.design.texts.bookBtn || '✅ Book Ride + OTP Generate'}</span>
        </button>
      </div>
      )}
      </>
      )}

      {/* RIDE HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-2 border-slate-900 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-yellow-400 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-yellow-400" />
                <h3 className="font-extrabold text-white text-base">Aapki Rides History</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {bookingHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">Koi purani rides nahi hain.</div>
              ) : (
                bookingHistory.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-500">{b.time}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          b.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'accepted'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {b.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      📍 {b.fromName} → 🏁 {b.toName}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="font-black text-slate-900">{b.price} ({b.km} KM)</span>
                      <span className="text-[11px] text-slate-600 font-semibold">OTP: {b.otp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* REFER & EARN MODAL (ৰেফাৰ আৰু উপাৰ্জন কৰক) */}
      {showReferralModal && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border-2 border-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between border-b-2 border-yellow-400">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-lg">
                  🎁
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-tight">Refer & Earn ₹50 Bonus</h3>
                  <p className="text-[11px] text-yellow-300 font-semibold">যাত্ৰা (YATRA) Referral Program</p>
                </div>
              </div>
              <button
                onClick={() => setShowReferralModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Wallet Balance Hero Card */}
              <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-4 text-slate-950 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900/80">
                    Your Wallet Balance
                  </span>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                </div>
                <div className="text-3xl font-black mt-1">
                  ₹{myRefData.walletBalance}
                </div>
                <p className="text-[11px] font-bold text-slate-900/90 mt-1">
                  Use this wallet balance for instant discounts when booking rides.
                </p>
              </div>

              {/* Your Unique Referral Code */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border-2 border-slate-200 space-y-2">
                <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Your Personal Referral Code
                </span>
                <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border-2 border-dashed border-yellow-500">
                  <span className="font-black text-lg text-slate-900 tracking-wider">
                    {myRefData.code}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(myRefData.code);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2500);
                    }}
                    className="py-1 px-3 bg-slate-900 hover:bg-slate-800 text-yellow-400 font-black text-xs rounded-lg flex items-center gap-1.5 transition"
                  >
                    {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRef ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp 1-Tap Share Button */}
              {(() => {
                const shareMsg = `Download 'যাত্ৰা (YATRA)' app for fast & reliable local rides! Use my referral code ${myRefData.code} to get ₹25 discount on your first booking! Link: ${window.location.origin}/?ref=${myRefData.code}`;
                const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`;

                return (
                  <div className="space-y-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl transition shadow-md flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>📲 Share with Friends on WhatsApp</span>
                    </a>

                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/?ref=${myRefData.code}`;
                        navigator.clipboard.writeText(link);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2500);
                      }}
                      className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedRef ? '✓ Link Copied!' : '🔗 Copy Referral Link'}</span>
                    </button>
                  </div>
                );
              })()}

              {/* How it works */}
              <div className="p-3.5 bg-yellow-50 rounded-2xl border border-yellow-200 space-y-2 text-xs">
                <span className="font-black text-slate-900 block">How it works:</span>
                <div className="space-y-1.5 text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-yellow-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                    <span>Share your referral code or link with friends.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-yellow-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                    <span>Your friend gets <strong>₹25 discount</strong> on their first ride.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-yellow-400 text-slate-950 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                    <span>You receive <strong>₹50 wallet bonus</strong> as soon as their ride completes!</span>
                  </div>
                </div>
              </div>

              {/* Referral Friends History */}
              <div>
                <span className="text-xs font-black text-slate-800 block mb-2">
                  Invited Friends (Total: {myRefData.totalInvited || 0}):
                </span>
                {(!myRefData.history || myRefData.history.length === 0) ? (
                  <div className="text-center py-5 bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-xs font-medium">
                    No friends invited yet. Share now to earn bonuses!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {myRefData.history.map((h, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200">
                        <div>
                          <span className="font-bold text-slate-900">{h.friendPhone}</span>
                          <span className="text-[10px] text-slate-400 block">{h.date}</span>
                        </div>
                        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          +₹{h.bonusEarned}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
