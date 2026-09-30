export interface VehicleConfig {
  name: string;
  rate: number;
  icon: string;
  commissionDaily: number;
  commissionMonthly: number;
}

export interface Booking {
  id: number;
  fromName: string;
  toName: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  km: string;
  price: string;
  vehicle: string;
  phone: string;
  name: string;
  otp: number;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  time: string;
  driver?: string;
  driverPhone?: string;
  driverName?: string;
  driverPhoto?: string;
  driverVehNo?: string;
  driverLoc?: { lat: number; lng: number };
  preferredDriver?: string;
  completedAt?: string;
}

export interface Driver {
  id: number;
  name: string;
  phone: string;
  pass: string;
  photo: string;
  vehno: string;
  vtype: string;
  loc: string;
  licence?: string;
  epfo?: string;
  esic?: string;
  aadhar?: string;
  esic_form?: string;
  pf_form?: string;
  carphoto?: string;
  licphoto?: string;
  status: 'pending' | 'approved' | 'rejected';
  locked?: boolean;
  isOnDuty?: boolean;
  created: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  pass: string;
  savedPlaces?: { label: string; name: string; lat: number; lng: number }[];
  createdAt: string;
}

export interface DriverPayment {
  id: number;
  phone: string;
  driverName?: string;
  vehicle: string;
  amt: number;
  type: 'Daily' | 'Monthly';
  date: string;
  note?: string;
}

export interface SoundConfig {
  preset: 'express' | 'radar' | 'siren' | 'horn' | 'bell' | 'custom';
  customAudioUrl?: string;
  customAudioName?: string;
  volume: number; // 0 to 1
  continuousLoop: boolean;
  vibration: boolean;
}

export interface AppConfig {
  baseFare: number;
  vehicles: VehicleConfig[];
  locations: string[];
  upi: string;
  qr: string;
  qrNote: string;
  apkVersion: number;
  apkLink: string;
  design: {
    logo: string;
    primary: string;
    dark: string;
    bg: string;
    card: string;
    texts: {
      customerHead: string;
      driverHead: string;
      bookBtn: string;
      currentBtn: string;
    };
  };
  adminDetails: {
    name: string;
    phone: string;
    email: string;
    address: string;
    support: string;
    whatsapp: string;
  };
  adminCred: {
    user: string;
    pass: string;
  };
}
