import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, update, remove, Database } from 'firebase/database';
import { getFirestore, doc, setDoc, getDocs, collection, query, where, Firestore } from 'firebase/firestore';
import { AppConfig, Booking } from '../types';
import { getAppConfig, saveAppConfig, getBookings, saveBookings } from './storage';

export const firebaseConfig = {
  apiKey: "AIzaSyAl3Y4UJ9XdI3xBXNF6PuIAypz3PjYv1ng",
  authDomain: "easy-trip-d601a.firebaseapp.com",
  databaseURL: "https://easy-trip-d601a-default-rtdb.firebaseio.com",
  projectId: "easy-trip-d601a",
  storageBucket: "easy-trip-d601a.appspot.com",
  messagingSenderId: "123456789000",
  appId: "1:123456789000:web:abcdef123456"
};

let db: Database | null = null;
let firestoreDb: Firestore | null = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getDatabase(app);
  firestoreDb = getFirestore(app);
} catch (e) {
  console.warn('Firebase initialization notice:', e);
}

export { db, firestoreDb };

// FIRESTORE TRIP HISTORY STORAGE
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

// 1. SYNC CONFIG (Auto-updates in APK and Web)
export function initFirebaseConfigSync(onConfigUpdated: (cfg: AppConfig) => void) {
  if (!db) return;

  const cfgRef = ref(db, FB_CONFIG_PATH);

  // Initial fetch
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

  // Live real-time listener (Auto updates on change)
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

// Push local config changes to Firebase
export function pushConfigToFirebase(cfg: AppConfig) {
  if (!db || isApplyingRemoteConfig) return;
  try {
    const cfgRef = ref(db, FB_CONFIG_PATH);
    set(cfgRef, cfg).catch((e) => console.warn('Firebase pushConfig error', e));
  } catch (e) {}
}

// 2. SYNC BOOKINGS (Customer <-> Driver across APK & Web)
export function initFirebaseBookingsSync(onBookingsUpdated: (bookings: Booking[]) => void) {
  if (!db) return;
  const bookingsRef = ref(db, 'bookings');

  onValue(bookingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data) {
        const list: Booking[] = Array.isArray(data)
          ? data.filter(Boolean)
          : Object.values(data);

        // Sort latest first
        list.sort((a, b) => Number(b.id) - Number(a.id));
        saveBookings(list);
        onBookingsUpdated(list);
      }
    }
  }, (err) => {
    console.warn('Firebase bookings listener notice', err);
  });
}

// Save or Update a single booking on Firebase (Realtime Database & Firestore)
export function syncBookingToFirebase(booking: Booking) {
  if (db) {
    try {
      const itemRef = ref(db, `bookings/${booking.id}`);
      set(itemRef, booking).catch((e) => console.warn('Firebase booking push error', e));
    } catch (e) {}
  }

  // Also store completed trips in Firestore
  if (booking.status === 'completed') {
    saveTripToFirestore(booking);
  }
}

// 3. DRIVER LIVE LOCATION SYNC (Firebase Jump Filter)
let _lastLoc: { lat: number; lng: number } | null = null;
let _lastLocTime = 0;

export function filterAndSyncDriverLocation(phone: string, loc: { lat: number; lng: number; speed?: number; bearing?: number }) {
  const now = Date.now();
  if (_lastLoc) {
    const dLat = (loc.lat - _lastLoc.lat) * 111000;
    const dLng = (loc.lng - _lastLoc.lng) * 111000 * Math.cos(loc.lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const dt = (now - _lastLocTime) / 1000;

    // Filter out crazy GPS teleportation (>400m in <20s)
    if (dist > 400 && dt < 20) {
      console.warn('FIREBASE JUMP BLOCKED:', dist.toFixed(0) + 'm in ' + dt.toFixed(0) + 's');
      return false;
    }
  }
  _lastLoc = { lat: loc.lat, lng: loc.lng };
  _lastLocTime = now;

  if (db && phone) {
    try {
      const cleanPhone = phone.replace(/[^\d]/g, '');
      const driverRef = ref(db, `drivers_live/${cleanPhone}`);
      set(driverRef, {
        ...loc,
        updatedAt: now
      }).catch((e) => console.warn('Firebase driver loc error', e));
    } catch (e) {}
  }
  return true;
}

// Listen to specific driver's live location on customer side
export function listenToDriverLiveLocation(driverPhone: string, onLocation: (loc: { lat: number; lng: number; speed?: number; bearing?: number }) => void) {
  if (!db || !driverPhone) return () => {};
  const cleanPhone = driverPhone.replace(/[^\d]/g, '');
  const driverRef = ref(db, `drivers_live/${cleanPhone}`);

  const unsubscribe = onValue(driverRef, (snapshot) => {
    if (snapshot.exists()) {
      const val = snapshot.val();
      if (val && val.lat && val.lng) {
        onLocation(val);
      }
    }
  });

  return () => {
    // Unsubscribe helper
  };
}
