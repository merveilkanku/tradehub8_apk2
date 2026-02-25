
export enum UserRole {
  USER = 'user',
  SUPPLIER = 'supplier'
}

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  XAF = 'XAF', // CFA Central Africa
  XOF = 'XOF', // CFA West Africa
  CDF = 'CDF', // Congolese Franc
  NGN = 'NGN', // Nigerian Naira
  KES = 'KES'  // Kenyan Shilling
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar_url?: string;
  bio?: string;
  country: string;
  city: string;
  address: string;
  is_verified_supplier: boolean;
  preferred_currency?: Currency;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  supplier_id: string;
  country: string;
  city: string;
  likes_count: number;
  created_at: string;
  moq?: number;
  specifications?: Record<string, string>;
  lead_time?: string;
  shipping_info?: string;
  trade_assurance?: boolean;
  liked_by_me?: boolean;
  profiles?: {
    username: string;
    is_verified_supplier: boolean;
    avatar_url?: string;
    country?: string;
    city?: string;
  };
}

export interface Comment {
  id: string;
  product_id: string;
  user_id: string;
  username: string;
  text: string;
  created_at: string;
}

export interface Message {
  id?: string;
  sender_id: string;
  receiver_id?: string;
  text: string;
  type: 'text' | 'image' | 'file' | 'call_log';
  file_url?: string;
  file_name?: string;
  is_read?: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  buyer_id: string;
  product_id: string;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  products?: {
    name: string;
    image_url: string;
    supplier_id: string;
  };
}

export const CATEGORIES = [
  'Électronique', 'Mode & Textile', 'Machines', 'Véhicules', 
  'Agriculture', 'Bâtiment', 'Santé', 'Énergie'
];

export const AFRICAN_CITIES = [
  { country: 'RDC', city: 'Kinshasa' },
  { country: 'RDC', city: 'Lubumbashi' },
  { country: 'RDC', city: 'Goma' },
  { country: 'Côte d’Ivoire', city: 'Abidjan' },
  { country: 'Sénégal', city: 'Dakar' },
  { country: 'Cameroun', city: 'Douala' },
  { country: 'Mali', city: 'Bamako' },
  { country: 'Gabon', city: 'Libreville' },
  { country: 'Bénin', city: 'Cotonou' },
  { country: 'Togo', city: 'Lomé' },
  { country: 'Congo', city: 'Brazzaville' }
];

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter?: { username: string };
  reported?: { username: string };
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'order' | 'message' | 'product';
  link?: string;
  is_read: boolean;
  created_at: string;
}

