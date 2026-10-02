import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, update, remove, Database } from 'firebase/database';
import {
  getFirestore, doc, setDoc, getDocs, collection, query, where,
  onSnapshot, updateDoc, serverTimestamp, orderBy, Firestore
} from 'firebase/firestore';
import { AppConfig, Booking, Driver } from '../types';
import { getAppConfig, saveAppConfig, getBookings, saveBookings, getDrivers } from './storage';

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

// =========================================================================
// 1. FIRESTORE et_bookings COLLECTION IMPLEMENTATION
// =========================================================================

/**
 * When customer clicks Book Now, save to Firestore collection `et_bookings` with:
 * customerName, phone, from, to, fromLat, fromLng, toLat, toLng, fare, status='pending', createdAt=serverTimestamp()
 */
export async function saveBookingToFirestore(booking: Booking): Promise<void> {
  // Sync to RTDB first for instant legacy compatibility
  if (db) {
    try {
      const itemRef = ref(db, `bookings/${booking.id}`);
      set(itemRef, booking).catch((e) => console.warn('RTDB booking push error', e));
    } catch (e) {}
  }

  if (!firestoreDb) return;
  try {
    const bookingDoc = doc(firestoreDb, 'et_bookings', String(booking.id));
    await setDoc(bookingDoc, {
      id: booking.id,
      customerName: booking.name || booking.customerName || 'Customer',
      name: booking.name || booking.customerName || 'Customer',
      phone: booking.phone || '',
      from: booking.fromName || booking.from || '',
      fromName: booking.fromName || booking.from || '',
      to: booking.toName || booking.to || '',
      toName: booking.toName || booking.to || '',
      fromLat: Number(booking.fromLat || 26.6247),
      fromLng: Number(booking.fromLng || 93.6035),
      toLat: Number(booking.toLat || 26.6247),
      toLng: Number(booking.toLng || 93.6035),
      fare: booking.price || booking.fare || '₹50',
      price: booking.price || booking.fare || '₹50',
      vehicle: booking.vehicle || 'Auto',
      otp: String(booking.otp || '1234'),
      km: String(booking.km || '1.0'),
      status: 'pending',
      time: booking.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore et_bookings save notice:', e);
  }
}

/**
 * In Driver portal - use onSnapshot on et_bookings where status=='pending'
 * to show real-time booking list to ALL drivers
 */
export function subscribeToPendingBookings(onBookings: (bookings: Booking[]) => void) {
  if (!firestoreDb) {
    // Fallback to RTDB
    return initFirebaseBookingsSync((all) => {
      onBookings(all.filter(b => b.status === 'pending'));
    });
  }

  try {
    const q = query(
      collection(firestoreDb, 'et_bookings'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: Number(d.id || docSnap.id),
          customerName: d.customerName || d.name || 'Customer',
          name: d.customerName || d.name || 'Customer',
          phone: d.phone || '',
          from: d.from || d.fromName || '',
          fromName: d.from || d.fromName || '',
          to: d.to || d.toName || '',
          toName: d.to || d.toName || '',
          fromLat: Number(d.fromLat || 26.6247),
          fromLng: Number(d.fromLng || 93.6035),
          toLat: Number(d.toLat || 26.6247),
          toLng: Number(d.toLng || 93.6035),
          fare: d.fare || d.price || '₹50',
          price: d.fare || d.price || '₹50',
          vehicle: d.vehicle || 'Auto',
          otp: d.otp || 1234,
          km: String(d.km || '1.0'),
          status: 'pending',
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
      console.warn('onSnapshot et_bookings pending error:', error);
      // Fallback to RTDB
      initFirebaseBookingsSync((all) => {
        onBookings(all.filter(b => b.status === 'pending'));
      });
    });

    return unsubscribe;
  } catch (e) {
    console.warn('subscribeToPendingBookings setup error:', e);
    return () => {};
  }
}

/**
 * In Admin portal - use onSnapshot on et_bookings to show all bookings
 */
export function subscribeToAllBookings(onBookings: (bookings: Booking[]) => void) {
  if (!firestoreDb) {
    return initFirebaseBookingsSync(onBookings);
  }

  try {
    const coll = collection(firestoreDb, 'et_bookings');
    const unsubscribe = onSnapshot(coll, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: Number(d.id || docSnap.id),
          customerName: d.customerName || d.name || 'Customer',
          name: d.customerName || d.name || 'Customer',
          phone: d.phone || '',
          from: d.from || d.fromName || '',
          fromName: d.from || d.fromName || '',
          to: d.to || d.toName || '',
          toName: d.to || d.toName || '',
          fromLat: Number(d.fromLat || 26.6247),
          fromLng: Number(d.fromLng || 93.6035),
          toLat: Number(d.toLat || 26.6247),
          toLng: Number(d.toLng || 93.6035),
          fare: d.fare || d.price || '₹50',
          price: d.fare || d.price || '₹50',
          vehicle: d.vehicle || 'Auto',
          otp: d.otp || 1234,
          km: String(d.km || '1.0'),
          status: (d.status as any) || 'pending',
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
      list.sort((a, b) => Number(b.id) - Number(a.id));
      saveBookings(list);
      onBookings(list);
    }, (error) => {
      console.warn('onSnapshot et_bookings all error:', error);
      initFirebaseBookingsSync(onBookings);
    });

    return unsubscribe;
  } catch (e) {
    console.warn('subscribeToAllBookings setup error:', e);
    return () => {};
  }
}

/**
 * When driver accepts booking, update booking status to 'accepted' and assign driverId
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
  const updatePayload = {
    status: 'accepted',
    driverId: String(driverInfo.driverId),
    driver: driverInfo.driverPhone,
    driverPhone: driverInfo.driverPhone,
    driverName: driverInfo.driverName,
    driverPhoto: driverInfo.driverPhoto || '',
    driverVehNo: driverInfo.driverVehNo || '',
    driverLoc: driverInfo.driverLoc || null,
    acceptedAt: new Date().toISOString()
  };

  // Sync to RTDB
  if (db) {
    try {
      const itemRef = ref(db, `bookings/${bookingId}`);
      update(itemRef, updatePayload).catch((e) => console.warn('RTDB accept update error', e));
    } catch (e) {}
  }

  // Update in Firestore et_bookings
  if (firestoreDb) {
    try {
      const bDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
      await setDoc(bDoc, updatePayload, { merge: true });
    } catch (e) {
      console.warn('Firestore acceptBooking error:', e);
    }
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

  if (db) {
    try {
      const itemRef = ref(db, `bookings/${bookingId}`);
      update(itemRef, updatePayload).catch((e) => console.warn('RTDB complete update error', e));
    } catch (e) {}
  }

  if (firestoreDb) {
    try {
      const bDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
      await setDoc(bDoc, updatePayload, { merge: true });
    } catch (e) {
      console.warn('Firestore completeBooking error:', e);
    }
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

  if (db) {
    try {
      const itemRef = ref(db, `bookings/${bookingId}`);
      update(itemRef, updatePayload).catch((e) => console.warn('RTDB cancel update error', e));
    } catch (e) {}
  }

  if (firestoreDb) {
    try {
      const bDoc = doc(firestoreDb, 'et_bookings', String(bookingId));
      await setDoc(bDoc, updatePayload, { merge: true });
    } catch (e) {
      console.warn('Firestore cancelBooking error:', e);
    }
  }
}

// =========================================================================
// 2. FIRESTORE et_drivers COLLECTION (ADMIN FLEET MAP)
// =========================================================================

/**
 * Sync driver profile & live location into Firestore collection `et_drivers`
 */
export async function syncDriverToFirestore(driver: Driver, coords?: [number, number]): Promise<void> {
  if (!firestoreDb || !driver) return;
  try {
    const cleanPhone = driver.phone.replace(/[^\d]/g, '') || String(driver.id);
    const driverDoc = doc(firestoreDb, 'et_drivers', cleanPhone);
    await setDoc(driverDoc, {
      id: driver.id,
      driverId: String(driver.id),
      name: driver.name,
      phone: driver.phone,
      vehno: driver.vehno,
      vtype: driver.vtype,
      loc: driver.loc,
      photo: driver.photo,
      status: driver.status,
      locked: Boolean(driver.locked),
      isOnDuty: driver.isOnDuty !== false,
      lat: coords ? coords[0] : (driver.lat || 26.6247),
      lng: coords ? coords[1] : (driver.lng || 93.6035),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.warn('Firestore syncDriverToFirestore notice:', e);
  }
}

/**
 * In admin map - use onSnapshot on et_drivers collection and show ALL drivers
 * with markers, not just one. Loop through all docs.
 */
export function subscribeToAllDrivers(onDrivers: (drivers: Driver[]) => void) {
  if (!firestoreDb) {
    onDrivers(getDrivers());
    return () => {};
  }

  try {
    const coll = collection(firestoreDb, 'et_drivers');
    const unsubscribe = onSnapshot(coll, (snapshot) => {
      const drivers: Driver[] = [];
      snapshot.forEach((docSnap) => {
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

      if (drivers.length > 0) {
        onDrivers(drivers);
      } else {
        // Seed default drivers from local if Firestore et_drivers is fresh
        const local = getDrivers();
        local.forEach(d => syncDriverToFirestore(d));
        onDrivers(local);
      }
    }, (error) => {
      console.warn('onSnapshot et_drivers error:', error);
      onDrivers(getDrivers());
    });

    return unsubscribe;
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
  if (!db) return;
  const bookingsRef = ref(db, 'bookings');

  onValue(bookingsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      if (data) {
        const list: Booking[] = Array.isArray(data)
          ? data.filter(Boolean)
          : Object.values(data);

        list.sort((a, b) => Number(b.id) - Number(a.id));
        saveBookings(list);
        onBookingsUpdated(list);
      }
    }
  }, (err) => {
    console.warn('Firebase bookings listener notice', err);
  });
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

  return () => {};
}
