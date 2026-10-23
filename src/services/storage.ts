import { AppConfig, Booking, CustomerUser, Driver, DriverPayment, SoundConfig, ReferralData } from '../types';

export const ASSAM_LOCATIONS: Record<string, [number, number]> = {
  "Bokakhat Town": [26.6247, 93.6035],
  "Bokakhat": [26.6247, 93.6035],
  "Bokakhat Railway Station": [26.626, 93.610],
  "Kaziranga Kohora": [26.578, 93.411],
  "Kaziranga Bagori": [26.565, 93.284],
  "Numaligarh Refinery": [26.595, 93.738],
  "Numaligarh Town": [26.59, 93.70],
  "Golaghat Town": [26.51, 93.96],
  "Dergaon": [26.70, 93.96],
  "Badulipar": [26.58, 93.85],
  "Kamargaon": [26.60, 93.80],
  "Titabar": [26.60, 94.20],
  "Furkating": [26.58, 93.92],
  "Jorhat Town": [26.75, 94.20],
  "Barpathar": [26.30, 93.85],
  "Sarupathar": [26.20, 93.90]
};

export const DEFAULT_CONFIG: AppConfig = {
  vehicles: [
    { name: "Bike", rate: 10, icon: "🏍️", commissionDaily: 50, commissionMonthly: 1000 },
    { name: "Scooty", rate: 12, icon: "🛵", commissionDaily: 60, commissionMonthly: 1200 },
    { name: "Auto", rate: 15, icon: "🛺", commissionDaily: 100, commissionMonthly: 2000 },
    { name: "Mini", rate: 15, icon: "🚗", commissionDaily: 150, commissionMonthly: 3000 },
    { name: "Sedan", rate: 20, icon: "🚙", commissionDaily: 200, commissionMonthly: 4000 },
    { name: "SUV", rate: 25, icon: "🚐", commissionDaily: 250, commissionMonthly: 5000 }
  ],
  baseFare: 40,
  locations: Object.keys(ASSAM_LOCATIONS),
  upi: "admin@upi",
  qr: "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=upi://pay?pa=admin@upi",
  qrNote: "Driver Daily ₹200 / Monthly ₹4000. Send payment screenshot to admin.",
  apkVersion: 34.0,
  apkLink: https://github.com/ankursaikia543-cmd/Bijay-saikia/releases/download/v2/yatra-v2.apk
  referral: {
    enabled: true,
    referrerBonus: 50, // ₹50 to inviter
    newUserDiscount: 25, // ₹25 instant off for friend
    promoMessageAssamese: "Download 'যাত্ৰা (YATRA)' App & use my referral code to get ₹25 discount on your first ride! Assam's trusted ride service."
  },
  design: {
    logo: "🚖 যাত্ৰা (YATRA)",
    primary: "#ffcc00",
    dark: "#0f172a",
    bg: "#f1f5f9",
    card: "round",
    texts: {
      customerHead: "📍 যাত্ৰা (YATRA) - Quick Booking",
      driverHead: "🚗 যাত্ৰা (YATRA) - Driver Portal",
      bookBtn: "✅ Book Ride + OTP",
      currentBtn: "📍 My Current Location"
    }
  },
  adminDetails: {
    name: "যাত্ৰা (YATRA) Head Office",
    phone: "8638803320, 7002754262",
    email: "support@yatra-assam.in",
    address: "Bokakhat, Golaghat, Assam pin 785612",
    support: "24/7 Available (Helpline & Ride Support)",
    whatsapp: "8638803320"
  },
  adminCred: {
    user: "admin",
    pass: "admin123"
  }
};

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  preset: 'express',
  volume: 0.9,
  continuousLoop: true,
  vibration: true
};

export function getAppConfig(): AppConfig {
  try {
    const raw = localStorage.getItem('et_cfg_v33_2');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        adminDetails: {
          ...DEFAULT_CONFIG.adminDetails,
          ...(parsed.adminDetails || {})
        }
      };
    }
  } catch (e) {}
  return DEFAULT_CONFIG;
}

export function saveAppConfig(cfg: AppConfig) {
  try {
    localStorage.setItem('et_cfg_v33_2', JSON.stringify(cfg));
  } catch (e) {}
}

export function getSoundConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem('et_sound_cfg');
    const customUrl = localStorage.getItem('et_ringtone') || undefined;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (customUrl) parsed.customAudioUrl = customUrl;
      return { ...DEFAULT_SOUND_CONFIG, ...parsed };
    }
    if (customUrl) {
      return { ...DEFAULT_SOUND_CONFIG, preset: 'custom', customAudioUrl: customUrl };
    }
  } catch (e) {}
  return DEFAULT_SOUND_CONFIG;
}

export function saveSoundConfig(cfg: SoundConfig) {
  try {
    localStorage.setItem('et_sound_cfg', JSON.stringify(cfg));
    if (cfg.customAudioUrl) {
      localStorage.setItem('et_ringtone', cfg.customAudioUrl);
    }
  } catch (e) {}
}

export function getBookings(): Booking[] {
  try {
    const raw = localStorage.getItem('et_book');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveBookings(bookings: Booking[]) {
  try {
    localStorage.setItem('et_book', JSON.stringify(bookings));
  } catch (e) {}
}

export function getDrivers(): Driver[] {
  try {
    const raw = localStorage.getItem('et_drivers');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // Default sample approved driver so user can test driver & live movements immediately
  const sampleDriver: Driver = {
    id: 101,
    name: "Raju Sharma",
    phone: "9876543210",
    pass: "1234",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    vehno: "AS 05 AB 4589",
    vtype: "Bike",
    loc: "Bokakhat Town",
    status: "approved",
    isOnDuty: true,
    created: new Date().toLocaleDateString()
  };
  return [sampleDriver];
}

export function saveDrivers(drivers: Driver[]) {
  try {
    localStorage.setItem('et_drivers', JSON.stringify(drivers));
  } catch (e) {}
}

export function getCurrentDriver(): Driver | null {
  try {
    const raw = localStorage.getItem('et_current_driver');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function setCurrentDriver(driver: Driver | null) {
  if (driver) {
    localStorage.setItem('et_current_driver', JSON.stringify(driver));
  } else {
    localStorage.removeItem('et_current_driver');
  }
}

export function getCustomers(): CustomerUser[] {
  try {
    const raw = localStorage.getItem('et_customers');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveCustomers(customers: CustomerUser[]) {
  try {
    localStorage.setItem('et_customers', JSON.stringify(customers));
  } catch (e) {}
}

export function getCurrentCustomer(): CustomerUser | null {
  try {
    const raw = localStorage.getItem('et_current_customer');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function setCurrentCustomer(customer: CustomerUser | null) {
  if (customer) {
    localStorage.setItem('et_current_customer', JSON.stringify(customer));
  } else {
    localStorage.removeItem('et_current_customer');
  }
}

export function getDriverDutyStatus(phone: string): boolean {
  try {
    const val = localStorage.getItem(`et_duty_${phone}`);
    if (val !== null) return val === 'true';
  } catch (e) {}
  return true; // Default to On Duty
}

export function setDriverDutyStatus(phone: string, isOnDuty: boolean) {
  try {
    localStorage.setItem(`et_duty_${phone}`, isOnDuty ? 'true' : 'false');
  } catch (e) {}
}

export function getDriverLocation(phone: string): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(`et_driver_loc_${phone}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

export function setDriverLocation(phone: string, loc: { lat: number; lng: number }) {
  try {
    localStorage.setItem(`et_driver_loc_${phone}`, JSON.stringify(loc));
  } catch (e) {}
}

export function getDriverPayments(): DriverPayment[] {
  try {
    const raw = localStorage.getItem('et_pay');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveDriverPayments(payments: DriverPayment[]) {
  try {
    localStorage.setItem('et_pay', JSON.stringify(payments));
  } catch (e) {}
}

// Distance in kilometers using Haversine formula
export function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing angle in degrees between two coordinates (for car rotation)
export function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lon2 - lon1) * (Math.PI / 180));
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// =========================================================================
// REFERRAL & BONUS SYSTEM (ৰেফাৰেল আৰু ইনাম ব্যৱস্থা)
// =========================================================================

export function generateReferralCode(phone: string): string {
  const clean = phone.replace(/[^\d]/g, '');
  const suffix = clean.length >= 4 ? clean.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
  return `YATRA-${suffix}`;
}

export function getReferralData(phone: string, name?: string): ReferralData {
  const cleanPhone = phone.trim();
  const code = generateReferralCode(cleanPhone);
  try {
    const raw = localStorage.getItem(`yatra_ref_${cleanPhone}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const defaultRef: ReferralData = {
    code,
    ownerPhone: cleanPhone,
    ownerName: name || 'Customer',
    totalInvited: 0,
    walletBalance: 0,
    createdAt: new Date().toISOString(),
    history: []
  };
  saveReferralData(defaultRef);
  return defaultRef;
}

export function saveReferralData(data: ReferralData) {
  try {
    localStorage.setItem(`yatra_ref_${data.ownerPhone}`, JSON.stringify(data));
    // Index by code
    localStorage.setItem(`yatra_ref_code_${data.code.toUpperCase()}`, JSON.stringify(data));
    
    // Also update all referrals list
    const all = getAllReferrals();
    const idx = all.findIndex(r => r.code === data.code);
    if (idx >= 0) {
      all[idx] = data;
    } else {
      all.push(data);
    }
    localStorage.setItem('yatra_all_referrals', JSON.stringify(all));
  } catch (e) {}
}

export function getAllReferrals(): ReferralData[] {
  try {
    const raw = localStorage.getItem('yatra_all_referrals');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function applyReferralCode(
  referralCode: string,
  userPhone: string,
  userName?: string
): { success: boolean; discount: number; message: string; referrerCode?: string } {
  const cleanCode = referralCode.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, discount: 0, message: 'ৰেফাৰেল ক\'ড খালি থাকিব নোৱাৰে।' };
  }

  // Check if user is using their own code
  const myCode = generateReferralCode(userPhone);
  if (cleanCode === myCode.toUpperCase()) {
    return { success: false, discount: 0, message: 'আপুনি নিজৰ ৰেফাৰেল ক\'ড নিজে ব্যৱহাৰ কৰিব নোৱাৰে।' };
  }

  // Check if this phone has already claimed a welcome referral discount
  const claimedKey = `yatra_ref_claimed_${userPhone.trim()}`;
  if (localStorage.getItem(claimedKey)) {
    return { success: false, discount: 0, message: 'আপুনি ইতিমধ্যে প্ৰথম ৰাইডৰ ৰেফাৰেল বোনাচ লাভ কৰিছে।' };
  }

  // Look up owner of referral code
  let refOwner: ReferralData | null = null;
  try {
    const raw = localStorage.getItem(`yatra_ref_code_${cleanCode}`);
    if (raw) refOwner = JSON.parse(raw);
  } catch (e) {}

  // If not found in code index, scan all referrals
  if (!refOwner) {
    const all = getAllReferrals();
    refOwner = all.find(r => r.code.toUpperCase() === cleanCode) || null;
  }

  // Award ₹25 instant discount to friend and ₹50 to inviter
  const discount = 25;
  const referrerBonus = 50;

  if (refOwner) {
    refOwner.totalInvited = (refOwner.totalInvited || 0) + 1;
    refOwner.walletBalance = (refOwner.walletBalance || 0) + referrerBonus;
    refOwner.history = refOwner.history || [];
    refOwner.history.push({
      friendPhone: userPhone.trim(),
      friendName: userName || 'New Friend',
      date: new Date().toLocaleDateString(),
      bonusEarned: referrerBonus,
      status: 'completed_ride'
    });
    saveReferralData(refOwner);
  }

  // Mark user as claimed
  localStorage.setItem(claimedKey, cleanCode);

  return {
    success: true,
    discount,
    referrerCode: cleanCode,
    message: `🎉 অভিনন্দন! ৰেফাৰেল ক'ড প্ৰয়োগ হ'ল। আপুনি ₹${discount} ৰেহাই লাভ কৰিছে!`
  };
}

export function deductWalletBalance(phone: string, amount: number): boolean {
  try {
    const refData = getReferralData(phone);
    if (refData.walletBalance >= amount) {
      refData.walletBalance -= amount;
      saveReferralData(refData);
      return true;
    }
  } catch (e) {}
  return false;
}
