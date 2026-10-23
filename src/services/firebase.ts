import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, update, Database } from 'firebase/database';
import {
  initializeFirestore, getFirestore, doc, setDoc, getDocs, collection, query, where,
  onSnapshot, updateDoc, serverTimestamp, orderBy, Firestore
} from 'firebase/firestore';
import { AppConfig, Booking, Driver, ReferralData, FirebaseApiConfig } from '../types';
import { getAppConfig, saveAppConfig, getBookings, saveBookings, getDrivers } from './storage';

// Default Firebase Configuration for যাত্ৰা (YATRA)
export const DEFAULT_FIREBASE_CONFIG: FirebaseApiConfig = {
  apiKey: "AIzaSyCmk5tezl0WeHgQn5diBkfQYF_KsqzwEGw",
  authDomain: "assam-easy-trip.firebaseapp.com",
  projectId: "assam-easy-trip",
  storageBucket: "assam-easy-trip.firebasestorage.app",
  messagingSenderId: "1061198552076",
  appId: "1:1061198552076:web:41407c10c89baa754a6229",
  measurementId: "G-E97XGL4BW9"
};

export function getStoredFirebaseConfig(): FirebaseApiConfig {
  try {
    const raw = localStorage.getItem('yatra_firebase_config');
    if (raw) return { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveStoredFirebaseConfig(cfg: FirebaseApiConfig) {
  try {
    localStorage.setItem('yatra_firebase_config', JSON.stringify(cfg));
  } catch (e) {}
}

export const firebaseConfig = getStoredFirebaseConfig();

let db: Database | null = null;
let firestoreDb: Firestore | null = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  try {
    // Force Long Polling to avoid WebChannel / gRPC timeouts in iframe & proxy environments
    firestoreDb = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true
    });
  } catch (fe) {
    firestoreDb = getFirestore(app);
  }
  try {
    db = getDatabase(app);
  } catch (e) {
    // RTDB optional
  }
} catch (e) {
  console.warn('Firebase initialization notice:', e);
}

export { db, firestoreDb };

// Helper to compute Google Map navigation link
export function getGoogleMapLink(fromLat?: number, fromLng?: number, toLat?: number, toLng?: number, fromText?: string, toText?: string): string {
  if (fromLat && toLat && !isNaN(fromLat) && !isNaN(toLat)) {
    return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(fromText || 'Pickup')}&destination=${encodeURIComponent(toText || 'Drop')}`;
}

// =========================================================================
// 1. FIRESTORE bookings COLLECTION IMPLEMENTATION
// =========================================================================

/**
 * When customer clicks Book Now, save to Firestore collection `bookings` (and `et_bookings`):
 * customerName, phone, pickup, drop, fromLat, fromLng, toLat, toLng, fare, googleMapLink, status='new', createdAt=serverTimestamp()
 */
export async function saveBookingToFirestore(booking: Booking): Promise<void> {
  const mapLink = getGoogleMapLink(
    booking.fromLat,
    booking.fromLng,
    booking.toLat,
    booking.toLng,
    booking.from || booking.fromName,
    booking.to || booking.toName
  );

  const payload = {
    id: String(booking.id),
    customerName: booking.name || booking.customerName || 'Customer',
    name: booking.name || booking.customerName || 'Customer',
    phone: booking.phone || '',
    pickup: booking.fromName || booking.from || '',
    from: booking.fromName || booking.from || '',
    fromName: booking.fromName || booking.from || '',
    drop: booking.toName || booking.to || '',
    to: booking.toName || booking.to || '',
    toName: booking.toName || booking.to || '',
    fromLat: Number(booking.fromLat || 26.6247),
    fromLng: Number(booking.fromLng || 93.6035),
    toLat: Number(booking.toLat || 26.6247),
    toLng: Number(booking.toLng || 93.6035),
    googleMapLink: mapLink,
    fare: booking.price || booking.fare || '₹50',
    price: booking.price || booking.fare || '₹50',
    vehicle: booking.vehicle || 'Auto',
    otp: String(booking.otp || '1234'),
    km: String(booking.km || '1.0'),
    status: 'new', // User explicitly requested status: "new"
    time: booking.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    createdAt: serverTimestamp()
  };

  if (!firestoreDb) return;
  try {
    const bookingDoc = doc(firestoreDb, 'bookings', String(booking.id));
    await setDoc(bookingDoc, payload, { merge: true });

    // Also sync to et_bookings for backward-compatibility
    const etDoc = doc(firestoreDb, 'et_bookings', String(booking.id));
    await setDoc(etDoc, payload, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Firestore bookings save notice:', e);
  }
}

/**
 * Driver portal:
 * db.collection("bookings").where("status","==","new").onSnapshot(snapshot => show all new bookings)
 * Driver ko sirf new bookings dikhao.
 */
export function subscribeToPendingBookings(onBookings: (bookings: Booking[]) => void) {
  if (!firestoreDb) {
    onBookings(getBookings().filter(b => b.status === 'new' || b.status === 'pending'));
    return () => {};
  }

  try {
    const q = query(
      collection(firestoreDb, 'bookings'),
      where('status', 'in', ['new', 'pending'])
    );

    let fallbackUnsub: (() => void) | null = null;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const fromVal = d.pickup || d.from || d.fromName || '';
        const toVal = d.drop || d.to || d.toName || '';
        const fLat = Number(d.fromLat || 26.6247);
        const fLng = Number(d.fromLng || 93.6035);
        const tLat = Number(d.toLat || 26.6247);
        const tLng = Number(d.toLng || 93.6035);

        list.push({
          id: Number(d.id || docSnap.id),
          customerName: d.customerName || d.name || 'Customer',
          name: d.customerName || d.name || 'Customer',
          phone: d.phone || '',
          pickup: fromVal,
          from: fromVal,
          fromName: fromVal,
          drop: toVal,
          to: toVal,
          toName: toVal,
          fromLat: fLat,
          fromLng: fLng,
          toLat: tLat,
          toLng: tLng,
          googleMapLink: d.googleMapLink || getGoogleMapLink(fLat, fLng, tLat, tLng, fromVal, toVal),
          fare: d.fare || d.price || '₹50',
          price: d.fare || d.price || '₹50',
          vehicle: d.vehicle || 'Auto',
          otp: d.otp || 1234,
          km: String(d.km || '1.0'),
          status: (d.status as any) || 'new',
          time: d.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          driver: d.driver || '',
          driverPhone: d.driverPhone || '',
          driverName: d.driverName || '',
          driverPhoto: d.driverPhoto || '',
          driverVehNo: d.driverVehNo || '',
          createdAt: d.createdAt
        });
      });
      list.sort((a, b) => Number(b.id) - Number(a.id));
      onBookings(list);
    }, (error) => {
      console.warn('onSnapshot bookings (in) notice:', error?.message || error);
      onBookings(getBookings().filter(b => b.status === 'new' || b.status === 'pending'));
      try {
        const qSingle = query(
          collection(firestoreDb!, 'bookings'),
          where('status', '==', 'new')
        );
        fallbackUnsub = onSnapshot(qSingle, (snap) => {
          const list: Booking[] = [];
          snap.forEach((docSnap) => {
            const d = docSnap.data();
            const fromVal = d.pickup || d.from || d.fromName || '';
            const toVal = d.drop || d.to || d.toName || '';
            const fLat = Number(d.fromLat || 26.6247);
            const fLng = Number(d.fromLng || 93.6035);
            const tLat = Number(d.toLat || 26.6247);
            const tLng = Number(d.toLng || 93.6035);

            list.push({
              id: Number(d.id || docSnap.id),
              customerName: d.customerName || d.name || 'Customer',
              name: d.customerName || d.name || 'Customer',
              phone: d.phone || '',
              pickup: fromVal,
              from: fromVal,
              fromName: fromVal,
              drop: toVal,
              to: toVal,
              toName: toVal,
              fromLat: fLat,
              fromLng: fLng,
              toLat: tLat,
              toLng: tLng,
              googleMapLink: d.googleMapLink || getGoogleMapLink(fLat, fLng, tLat, tLng, fromVal, toVal),
              fare: d.fare || d.price || '₹50',
              price: d.fare || d.price || '₹50',
              vehicle: d.vehicle || 'Auto',
              otp: d.otp || 1234,
              km: String(d.km || '1.0'),
              status: (d.status as any) || 'new',
              time: d.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              createdAt: d.createdAt
            });
          });
          list.sort((a, b) => Number(b.id) - Number(a.id));
          onBookings(list);
        }, () => {
          onBookings(getBookings().filter(b => b.status === 'new' || b.status === 'pending'));
        });
      } catch (e2) {
        onBookings(getBookings().filter(b => b.status === 'new' || b.status === 'pending'));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof fallbackUnsub === 'function') (fallbackUnsub as any)();
    };
  } catch (e) {
    console.warn('subscribeToPendingBookings setup error:', e);
    return () => {};
  }
}

/**
 * Admin page:
 * db.collection("bookings").orderBy("createdAt","desc").onSnapshot(snapshot => show data)
 * Table me pickup, drop, phone, status aur Google Map link dikhao.
 * No fake data, only Firestore data.
 */
export function subscribeToAllBookings(onBookings: (bookings: Booking[]) => void) {
  if (!firestoreDb) {
    onBookings([]);
    return () => {};
  }

  const mapSnapshotToBookings = (snapshot: any) => {
    const list: Booking[] = [];
    snapshot.forEach((docSnap: any) => {
      const d = docSnap.data();
      const fromVal = d.pickup || d.from || d.fromName || '';
      const toVal = d.drop || d.to || d.toName || '';
      const fLat = Number(d.fromLat || 26.6247);
      const fLng = Number(d.fromLng || 93.6035);
      const tLat = Number(d.toLat || 26.6247);
      const tLng = Number(d.toLng || 93.6035);

      list.push({
        id: Number(d.id || docSnap.id),
        customerName: d.customerName || d.name || 'Customer',
        name: d.customerName || d.name || 'Customer',
        phone: d.phone || '',
        pickup: fromVal,
        from: fromVal,
        fromName: fromVal,
        drop: toVal,
        to: toVal,
        toName: toVal,
        fromLat: fLat,
        fromLng: fLng,
        toLat: tLat,
        toLng: tLng,
        googleMapLink: d.googleMapLink || getGoogleMapLink(fLat, fLng, tLat, tLng, fromVal, toVal),
        fare: d.fare || d.price || '₹50',
        price: d.fare || d.price || '₹50',
        vehicle: d.vehicle || 'Auto',
        otp: d.otp || 1234,
        km: String(d.km || '1.0'),
        status: (d.status as any) || 'new',
        time: d.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        driverId: d.driverId,
        driver: d.driver || d.driverPhone || '',
        driverPhone: d.driverPhone || d.driver || '',
        driverName: d.driverName || '',
        driverPhoto: d.driverPhoto || '',
        driverVehNo: d.driverVehNo || '',
        driverLoc: d.driverLoc,
        completedAt: d.completedAt,
        cancelledAt: d.cancelledAt,
        createdAt: d.createdAt
      });
    });

    // Sort by id descending
    list.sort((a, b) => Number(b.id) - Number(a.id));
    saveBookings(list);
    onBookings(list);
  };

  try {
    // Primary: db.collection("bookings").orderBy("createdAt", "desc")
    const q = query(collection(firestoreDb, 'bookings'), orderBy('createdAt', 'desc'));
    let fallbackUnsub: (() => void) | null = null;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      mapSnapshotToBookings(snapshot);
    }, (error) => {
      console.warn('onSnapshot bookings orderBy notice:', error?.message || error);
      onBookings(getBookings());
      // Fallback if orderBy index is not set up yet
      try {
        const fallbackQuery = collection(firestoreDb!, 'bookings');
        fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
          mapSnapshotToBookings(snapshot);
        }, (err2) => {
          console.warn('bookings fallback notice:', err2?.message || err2);
          onBookings(getBookings());
        });
      } catch (err3) {
        onBookings(getBookings());
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof fallbackUnsub === 'function') (fallbackUnsub as any)();
    };
  } catch (e) {
    console.warn('subscribeToAllBookings setup error:', e);
    onBookings(getBookings());
    return () => {};
  }
}

/**
 * When driver accepts booking:
 * db.collection("bookings").doc(bookingId).update({status:"accepted", driverId: driverPhone, driverName: driverName})
 */
export async function acceptBookingInFirestore(
  bookingId: number | string,
  driverInfo: {
    driverId: string;
    driverPhone: string;
    driverName: string;
    driverPhoto?: string;
    driverVehNo?: string;
    driverLoc?: { lat: number; lng: number };
  }
): Promise<void> {
  const assignedDriverId = String(driverInfo.driverPhone || driverInfo.driverId);
  const updatePayload = {
    status: 'accepted',
    driverId: assignedDriverId,
    driver: driverInfo.driverPhone,
    driverPhone: driverInfo.driverPhone,
    driverName: driverInfo.driverName,
    driverPhoto: driverInfo.driverPhoto || '',
    driverVehNo: driverInfo.driverVehNo || '',
    driverLoc: driverInfo.driverLoc || null,
    acceptedAt: new Date().toISOString()
  };

  if (!firestoreDb) return;
  try {
    const bDoc = doc(firestoreDb, 'bookings', String(bookingId));
    await setDoc(bDoc, updatePayload, { merge: true });

    // Also update et_bookings
    const etDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
    await setDoc(etDoc, updatePayload, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Firestore acceptBooking error:', e);
  }
}

/**
 * Complete a booking in Firestore
 */
export async function completeBookingInFirestore(bookingId: number | string): Promise<void> {
  const completedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const updatePayload = {
    status: 'completed',
    completedAt: completedTime
  };

  if (!firestoreDb) return;
  try {
    const bDoc = doc(firestoreDb, 'bookings', String(bookingId));
    await setDoc(bDoc, updatePayload, { merge: true });
    const etDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
    await setDoc(etDoc, updatePayload, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Firestore completeBooking error:', e);
  }
}

/**
 * Cancel a booking in Firestore
 */
export async function cancelBookingInFirestore(bookingId: number | string): Promise<void> {
  const cancelledTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const updatePayload = {
    status: 'cancelled',
    cancelledAt: cancelledTime
  };

  if (!firestoreDb) return;
  try {
    const bDoc = doc(firestoreDb, 'bookings', String(bookingId));
    await setDoc(bDoc, updatePayload, { merge: true });
    const etDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
    await setDoc(etDoc, updatePayload, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Firestore cancelBooking error:', e);
  }
}

// =========================================================================
// 2. FIRESTORE drivers COLLECTION (ADMIN FLEET MAP & REAL-TIME DRIVERS)
// =========================================================================

/**
 * Sync driver profile & live location into Firestore collection `drivers`
 */
export async function syncDriverToFirestore(driver: Driver, coords?: [number, number]): Promise<void> {
  if (!firestoreDb || !driver) return;
  try {
    const cleanPhone = driver.phone.replace(/[^\d]/g, '') || String(driver.id);
    const dPayload = {
      id: driver.id,
      driverId: String(driver.id),
      name: driver.name,
      phone: driver.phone,
      pass: driver.pass || '1234',
      vehno: driver.vehno,
      vtype: driver.vtype,
      loc: driver.loc || 'Bokakhat Town',
      photo: driver.photo,
      licence: driver.licence || '',
      aadhar: driver.aadhar || '',
      epfo: driver.epfo || '',
      esic: driver.esic || '',
      carphoto: driver.carphoto || '',
      licphoto: driver.licphoto || '',
      status: driver.status || 'approved',
      locked: Boolean(driver.locked),
      isOnDuty: driver.isOnDuty !== false,
      registeredFrom: driver.registeredFrom || 'app',
      lat: coords ? coords[0] : (driver.lat || 26.6247),
      lng: coords ? coords[1] : (driver.lng || 93.6035),
      created: driver.created || new Date().toLocaleDateString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const driverDoc = doc(firestoreDb, 'drivers', cleanPhone);
    await setDoc(driverDoc, dPayload, { merge: true });

    // Also sync to et_drivers for backwards compatibility
    const etDriverDoc = doc(firestoreDb, 'et_drivers', cleanPhone);
    await setDoc(etDriverDoc, dPayload, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Firestore syncDriverToFirestore notice:', e);
  }
}

/**
 * Called when a new driver registers in App, APK, or Web Portal
 * Instantly broadcasts to Admin Portal via Firestore
 */
export async function registerDriverToFirestore(driver: Driver): Promise<void> {
  await syncDriverToFirestore(driver);
  if (!firestoreDb) return;
  try {
    const notifRef = doc(collection(firestoreDb, 'driver_registrations'));
    await setDoc(notifRef, {
      driverPhone: driver.phone,
      driverName: driver.name,
      vehno: driver.vehno,
      vtype: driver.vtype,
      registeredAt: serverTimestamp(),
      source: driver.registeredFrom || 'app'
    });
  } catch (e) {}
}

/**
 * Sync Referral Data to Firestore for real-time tracking
 */
export async function syncReferralToFirestore(refData: ReferralData): Promise<void> {
  if (!firestoreDb || !refData) return;
  try {
    const refDoc = doc(firestoreDb, 'referrals', refData.code.toUpperCase());
    await setDoc(refDoc, {
      ...refData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore syncReferral notice:', e);
  }
}

/**
 * Real-time listener for all referrals in Admin Dashboard
 */
export function subscribeToReferrals(onReferrals: (refs: ReferralData[]) => void) {
  if (!firestoreDb) return () => {};
  try {
    const coll = collection(firestoreDb, 'referrals');
    return onSnapshot(coll, (snapshot) => {
      const list: ReferralData[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as ReferralData);
      });
      list.sort((a, b) => (b.totalInvited || 0) - (a.totalInvited || 0));
      onReferrals(list);
    }, (err) => {
      console.warn('onSnapshot referrals notice:', err);
    });
  } catch (e) {
    return () => {};
  }
}

/**
 * Admin:
 * db.collection("drivers").orderBy("createdAt","desc").onSnapshot(snapshot => show data)
 * In admin map - show ALL drivers with markers, not just one. Loop through all docs.
 * No fake data, only Firestore data.
 */
export function subscribeToAllDrivers(onDrivers: (drivers: Driver[]) => void) {
  if (!firestoreDb) {
    onDrivers(getDrivers());
    return () => {};
  }

  const mapSnapshotToDrivers = (snapshot: any) => {
    const drivers: Driver[] = [];
    snapshot.forEach((docSnap: any) => {
      const d = docSnap.data();
      drivers.push({
        id: Number(d.id || 1),
        driverId: String(d.driverId || d.id),
        name: d.name || 'Driver',
        phone: d.phone || docSnap.id,
        pass: d.pass || '1234',
        photo: d.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        vehno: d.vehno || 'AS-05-XXXX',
        vtype: d.vtype || 'Auto',
        loc: d.loc || 'Bokakhat Town',
        lat: Number(d.lat || 26.6247),
        lng: Number(d.lng || 93.6035),
        status: (d.status as any) || 'approved',
        locked: Boolean(d.locked),
        isOnDuty: d.isOnDuty !== false,
        created: d.created || new Date().toLocaleDateString()
      });
    });

    onDrivers(drivers);
  };

  try {
    // db.collection("drivers").orderBy("createdAt", "desc")
    const q = query(collection(firestoreDb, 'drivers'), orderBy('createdAt', 'desc'));
    let fallbackUnsub: (() => void) | null = null;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.size > 0) {
        mapSnapshotToDrivers(snapshot);
      } else {
        // If drivers collection is currently empty, check et_drivers fallback
        const etColl = collection(firestoreDb!, 'et_drivers');
        fallbackUnsub = onSnapshot(etColl, (etSnap) => {
          if (etSnap.size > 0) {
            mapSnapshotToDrivers(etSnap);
          } else {
            onDrivers(getDrivers());
          }
        }, () => onDrivers(getDrivers()));
      }
    }, (error) => {
      console.warn('onSnapshot drivers notice:', error?.message || error);
      onDrivers(getDrivers());
      try {
        const fallbackQuery = collection(firestoreDb!, 'drivers');
        fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
          if (snapshot.size > 0) {
            mapSnapshotToDrivers(snapshot);
          } else {
            onDrivers(getDrivers());
          }
        }, () => onDrivers(getDrivers()));
      } catch (err2) {
        onDrivers(getDrivers());
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      if (typeof fallbackUnsub === 'function') (fallbackUnsub as any)();
    };
  } catch (e) {
    console.warn('subscribeToAllDrivers setup error:', e);
    onDrivers(getDrivers());
    return () => {};
  }
}

// =========================================================================
// 3. TRIP HISTORY & CONFIG
// =========================================================================

export async function saveTripToFirestore(trip: Booking) {
  if (!firestoreDb) return;
  try {
    const tripDoc = doc(firestoreDb, 'trip_history', String(trip.id));
    await setDoc(tripDoc, {
      ...trip,
      savedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore trip save notice:', e);
  }
}

export async function getCustomerTripsFromFirestore(phone?: string): Promise<Booking[]> {
  if (!firestoreDb) return [];
  try {
    const coll = collection(firestoreDb, 'trip_history');
    let q = query(coll);
    if (phone) {
      q = query(coll, where('phone', '==', phone.trim()));
    }
    const snap = await getDocs(q);
    const trips: Booking[] = [];
    snap.forEach((d) => {
      trips.push(d.data() as Booking);
    });
    trips.sort((a, b) => Number(b.id) - Number(a.id));
    return trips;
  } catch (e) {
    console.warn('Firestore fetch trips notice:', e);
    return [];
  }
}

const FB_CONFIG_PATH = 'config/et_cfg_v33_2';
let isApplyingRemoteConfig = false;

// SYNC CONFIG (Auto-updates in APK and Web)
export function initFirebaseConfigSync(onConfigUpdated: (cfg: AppConfig) => void) {
  if (!db) return;

  const cfgRef = ref(db, FB_CONFIG_PATH);

  get(cfgRef).then((snapshot) => {
    if (snapshot.exists()) {
      const remote = snapshot.val();
      if (remote) {
        isApplyingRemoteConfig = true;
        saveAppConfig(remote);
        onConfigUpdated(remote);
        isApplyingRemoteConfig = false;
      }
    }
  }).catch((e) => console.warn('Firebase initial config fetch error', e));

  onValue(cfgRef, (snapshot) => {
    if (snapshot.exists()) {
      const remote = snapshot.val();
      if (remote) {
        isApplyingRemoteConfig = true;
        saveAppConfig(remote);
        onConfigUpdated(remote);
        isApplyingRemoteConfig = false;
      }
    }
  }, (err) => {
    console.warn('Firebase config listener notice', err);
  });
}

export function pushConfigToFirebase(cfg: AppConfig) {
  if (!db || isApplyingRemoteConfig) return;
  try {
    const cfgRef = ref(db, FB_CONFIG_PATH);
    set(cfgRef, cfg).catch((e) => console.warn('Firebase pushConfig error', e));
  } catch (e) {}
}

export function initFirebaseBookingsSync(onBookingsUpdated: (bookings: Booking[]) => void) {
  subscribeToAllBookings(onBookingsUpdated);
}

export function syncBookingToFirebase(booking: Booking) {
  saveBookingToFirestore(booking);
}

// 4. DRIVER LIVE LOCATION SYNC (Firebase Jump Filter)
let _lastLoc: { lat: number; lng: number } | null = null;
let _lastLocTime = 0;

export function filterAndSyncDriverLocation(phone: string, loc: { lat: number; lng: number; speed?: number; bearing?: number }) {
  const now = Date.now();
  if (_lastLoc) {
    const dLat = (loc.lat - _lastLoc.lat) * 111000;
    const dLng = (loc.lng - _lastLoc.lng) * 111000 * Math.cos(loc.lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const dt = (now - _lastLocTime) / 1000;

    if (dist > 400 && dt < 20) {
      console.warn('FIREBASE JUMP BLOCKED:', dist.toFixed(0) + 'm in ' + dt.toFixed(0) + 's');
      return false;
    }
  }
  _lastLoc = { lat: loc.lat, lng: loc.lng };
  _lastLocTime = now;

  if (firestoreDb && phone) {
    try {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const driverRef = doc(firestoreDb, 'drivers', cleanPhone);
      setDoc(driverRef, {
        lat: loc.lat,
        lng: loc.lng,
        speed: loc.speed || 0,
        bearing: loc.bearing || 0,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch((e) => console.warn('Firebase driver loc error', e));
    } catch (e) {}
  }
  return true;
}

export function listenToDriverLiveLocation(driverPhone: string, onLocation: (loc: { lat: number; lng: number; speed?: number; bearing?: number }) => void) {
  if (!firestoreDb || !driverPhone) return () => {};
  const cleanPhone = driverPhone.replace(/[^\d]/g, '');
  const driverRef = doc(firestoreDb, 'drivers', cleanPhone);

  const unsubscribe = onSnapshot(driverRef, (docSnap) => {
    if (docSnap.exists()) {
      const val = docSnap.data();
      if (val && val.lat && val.lng) {
        onLocation({ lat: val.lat, lng: val.lng, speed: val.speed, bearing: val.bearing });
      }
    }
  });

  return unsubscribe;
}
