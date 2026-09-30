import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, User, CheckCircle, RefreshCw, History, Car, ArrowRight, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { AppConfig, Booking, CustomerUser, VehicleConfig } from '../types';
import { ASSAM_LOCATIONS, calcDistanceKm, getBookings, saveBookings, getDrivers } from '../services/storage';
import { initFirebaseBookingsSync, syncBookingToFirebase, listenToDriverLiveLocation, getCustomerTripsFromFirestore } from '../services/firebase';
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
  const [isLocating, setIsLocating] = useState(false);
  const [clickStep, setClickStep] = useState<'from' | 'to'>('from');

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
    initFirebaseBookingsSync((remoteBookings) => {
      if (remoteBookings && remoteBookings.length > 0) {
        if (phone) {
          const myBookings = remoteBookings.filter(b => b.phone === phone);
          setBookingHistory(myBookings);
          const active = myBookings.find(b => b.status === 'pending' || b.status === 'accepted');
          if (active) {
            setActiveBooking(active);
            if (!fromCoords && active.fromLat) setFromCoords([active.fromLat, active.fromLng]);
            if (!toCoords && active.toLat) setToCoords([active.toLat, active.toLng]);
          }
        }
      }
    });

    const interval = setInterval(loadBookingsState, 3000);
    return () => clearInterval(interval);
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
    if (phone) {
      const myBookings = all.filter(b => b.phone === phone);
      setBookingHistory(myBookings);
      const active = myBookings.find(b => b.status === 'pending' || b.status === 'accepted');
      if (active) {
        setActiveBooking(active);
        if (!fromCoords && active.fromLat) setFromCoords([active.fromLat, active.fromLng]);
        if (!toCoords && active.toLat) setToCoords([active.toLat, active.toLng]);
      } else if (activeBooking && activeBooking.status === 'accepted') {
        const completed = myBookings.find(b => b.id === activeBooking.id && b.status === 'completed');
        if (completed) setActiveBooking(completed);
      }
    } else {
      const pendingOrAccepted = all.find(b => b.status === 'pending' || b.status === 'accepted');
      if (pendingOrAccepted && (!activeBooking || activeBooking.id === pendingOrAccepted.id)) {
        setActiveBooking(pendingOrAccepted);
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

  // Create Ride Booking
  const handleCreateBooking = () => {
    if (!fromCoords || !toCoords || !fromLocation || !toLocation) {
      alert('Kripya Pickup (From) aur Drop (To) dono select karein!');
      return;
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();

    if (!cleanPhone || !cleanName) {
      alert('Customer Naam aur Phone number daalna zaroori hai!');
      return;
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    const newBooking: Booking = {
      id: Date.now(),
      fromName: fromLocation,
      toName: toLocation,
      fromLat: fromCoords[0],
      fromLng: fromCoords[1],
      toLat: toCoords[0],
      toLng: toCoords[1],
      km: distanceKm,
      price: `₹${calculatedPrice}`,
      vehicle: selectedVehicle,
      phone: cleanPhone,
      name: cleanName,
      otp: otp,
      status: 'pending',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const all = getBookings();
    all.unshift(newBooking);
    saveBookings(all);
    syncBookingToFirebase(newBooking);
    setActiveBooking(newBooking);
    setBookingHistory(prev => [newBooking, ...prev]);

    // Scroll to tracking section
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  // Cancel or Clear Booking
  const handleClearBooking = () => {
    if (activeBooking && activeBooking.status === 'pending') {
      const all = getBookings().filter(b => b.id !== activeBooking.id);
      saveBookings(all);
      syncBookingToFirebase({ ...activeBooking, status: 'cancelled' });
    }
    setActiveBooking(null);
    setFromCoords(null);
    setToCoords(null);
    setFromLocation('');
    setToLocation('');
    setDistanceKm('0.00');
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

        {/* ESTIMATED FARE BANNER - ADMIN FIXED CALCULATION */}
        <div className="bg-slate-900 text-yellow-400 p-4 rounded-2xl flex items-center justify-between shadow-md border-2 border-yellow-400/40">
          <div>
            <div className="text-[10px] font-extrabold tracking-wider uppercase text-yellow-400/80">
              Admin Fixed Rate: {selectedVehicle} @ ₹{config.vehicles.find(v => v.name === selectedVehicle)?.rate || 15}/KM
            </div>
            <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{distanceKm} KM</span>
              <span className="text-slate-500">•</span>
              <span className="text-yellow-400">{selectedVehicle}</span>
              <span className="text-[11px] text-emerald-400 font-semibold">(Base ₹{config.baseFare ?? 40} included)</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black text-yellow-400">
              ₹{calculatedPrice}
            </div>
            <div className="text-[10px] text-emerald-400 font-extrabold">
              ✓ Instant Fixed Fare
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
    </div>
  );
};
