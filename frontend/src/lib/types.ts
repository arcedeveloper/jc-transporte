// Tipos de las respuestas del backend.

export type Role = 'admin' | 'driver';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

export interface RouteOption {
  origin: string;
  destination: string;
  durationMinutes: number;
  basePrice: number;
  imageUrl: string | null;
}

export interface LocationsResponse {
  origins: string[];
  destinations: string[];
  routes: RouteOption[];
}

/** Lo que el pasajero ve del bus */
export interface BusPublic {
  name: string;
  capacity: number;
  description: string | null;
  photoIds: string[];
}

export interface TripSummary {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  price: number;
  busName: string;
  bus: BusPublic;
  capacity: number;
  /** Lugares libres */
  availableSeats: number;
  soldOut: boolean;
  /** El admin confirmó el viaje y cerró las reservas */
  closed: boolean;
  bookable: boolean;
}

export interface Availability {
  capacity: number;
  occupied: number;
  available: number;
  soldOut: boolean;
  closed: boolean;
  bookable: boolean;
}

export interface TripDetailResponse extends Availability {
  trip: {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    /** Hora de salida de vuelta (si el viaje tiene retorno) */
    returnTime: string | null;
    durationMinutes: number;
    price: number;
    status: TripStatus;
    busName: string;
    bus: BusPublic;
    /** PDF con los detalles del paquete */
    pdf: { id: string; fileName: string } | null;
    /** Publicidad del viaje (imagen y textos que carga el admin) */
    promo?: TripPromo;
  };
}

export interface PaymentInfo {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  bankRuc: string | null;
  bankAlias: string | null;
  whatsappUrl: string;
}

export interface PublicBooking {
  code: string;
  status: BookingStatus;
  contactPhone: string;
  numberOfPassengers: number;
  totalAmount: number;
  paymentDeadline: string;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  trip: { id: string; origin: string; destination: string; departureTime: string; arrivalTime: string; returnTime?: string | null };
  passengers: { fullName: string }[];
  payment: PaymentInfo | null;
}

// ---------- Admin ----------

export interface AdminRoute {
  id: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  basePrice: number;
  imageUrl: string | null;
  isActive: boolean;
  _count?: { trips: number };
}

export interface AdminBus {
  id: string;
  name: string;
  plate: string;
  /** Lugares que se venden por viaje */
  capacity: number;
  description: string | null;
  isActive: boolean;
  _count: { trips: number };
  photos: { id: string; position: number }[];
}

export interface AdminTrip {
  id: string;
  busId: string;
  routeId: string;
  driverId: string | null;
  departureTime: string;
  arrivalTime: string;
  returnTime: string | null;
  price: number;
  status: TripStatus;
  bookingClosed: boolean;
  pdfId: string | null;
  pdf: { id: string; fileName: string } | null;
  closedAt: string | null;
  currentLat: number | null;
  currentLng: number | null;
  currentSpeed: number | null;
  lastLocationAt: string | null;
  route: AdminRoute;
  bus: { id: string; name: string; plate: string; capacity: number };
  driver: { id: string; fullName: string } | null;
  /** Pasajeros en reservas activas (pendientes + confirmadas) */
  occupied: number;
  /** Publicidad en la portada */
  showOnHome: boolean;
  promoLayout: PromoLayout;
  promoTitle: string | null;
  promoText: string | null;
  promoImageId: string | null;
}

export interface AdminPassenger {
  id: string;
  fullName: string;
  document: string;
  phone: string;
  boarded: boolean;
}

export interface AdminBooking {
  id: string;
  tripId: string;
  bookingCode: string;
  contactEmail: string | null;
  contactPhone: string;
  numberOfPassengers: number;
  totalAmount: number;
  status: BookingStatus;
  notes: string | null;
  paymentDeadline: string;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  trip: { id: string; departureTime: string; arrivalTime: string; route: { origin: string; destination: string } };
  passengers: AdminPassenger[];
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Settings {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  bankRuc: string | null;
  bankAlias: string | null;
  adminWhatsapp: string;
  adminEmail: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  signMessages?: string[];
  signShowRoutes?: boolean;
  groupMinPeople?: number;
  groupMaxPeople?: number;
  groupMinDays?: number;
}

export interface Dashboard {
  today: string;
  bookings: Record<BookingStatus, number>;
  revenueTotal: number;
  revenueByDay: { day: string; total: number; count: number }[];
  todayTrips: {
    id: string;
    origin: string;
    destination: string;
    departureTime: string;
    status: TripStatus;
    busName: string;
    driverName: string | null;
    bookingClosed: boolean;
    occupiedSeats: number;
    totalSeats: number;
  }[];
  upcomingOccupancy: { id: string; label: string; departureTime: string; bookingClosed: boolean; occupiedSeats: number; totalSeats: number }[];
}

export interface TripLocation {
  tripId: string;
  status: TripStatus;
  label: string;
  departureTime: string;
  busName: string;
  busPlate: string;
  driverName: string | null;
  location: { lat: number; lng: number; speed: number | null; at: string } | null;
}

// ---------- Chofer ----------

export interface DriverTrip {
  id: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  returnTime: string | null;
  status: TripStatus;
  busName: string;
  busPlate: string;
  occupiedSeats?: number;
  lastLocationAt: string | null;
  /** Sueldo del chofer cargado por la oficina (null = a confirmar) */
  pay?: number | null;
}

export interface DriverPassenger {
  id: string;
  fullName: string;
  document: string;
  phone: string;
  boarded: boolean;
  bookingCode: string;
  bookingStatus: BookingStatus;
}

export interface VerifyResult {
  code: string;
  valid: boolean;
  reason?: string;
  passengers?: { id: string; fullName: string; document: string; boarded: boolean }[];
}

// ---------- Publicidad, viajes grupales y sugerencias ----------
export type TimeSlot = 'morning' | 'afternoon' | 'night' | 'any';
export type PromoLayout = 'square' | 'wide';
export type GroupRequestStatus = 'new' | 'contacted' | 'accepted' | 'dismissed';

export interface TripPromo {
  layout: PromoLayout;
  title: string | null;
  text: string | null;
  imageId: string | null;
}

/** Tarjeta de publicidad de la portada: un viaje publicado */
export interface FeaturedTrip extends TripSummary {
  promo: TripPromo;
}

export interface GroupRequest {
  id: string;
  origin: string;
  destination: string;
  date: string;
  returnDate: string | null;
  preferredTime: TimeSlot;
  passengers: number;
  fullName: string;
  document: string;
  contactPhone: string;
  notes: string | null;
  status: GroupRequestStatus;
  tripId: string | null;
  notifiedAt: string | null;
  createdAt: string;
  trip: { id: string; departureTime: string; price: number; status: TripStatus; route: { origin: string; destination: string } } | null;
}

export interface Suggestion {
  id: string;
  destination: string;
  origin: string | null;
  whenText: string | null;
  message: string | null;
  name: string | null;
  contactPhone: string | null;
  isRead: boolean;
  createdAt: string;
}

// ---------- Gastos y cuentas ----------
export type ExpenseCategory = 'driver' | 'supplies' | 'repair' | 'fuel' | 'other';

export const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  driver: 'Sueldo del chofer',
  supplies: 'Insumos (agua, obsequios)',
  repair: 'Reparación o imprevisto',
  fuel: 'Combustible',
  other: 'Otro',
};

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  date: string;
  tripId: string | null;
  driverId: string | null;
  createdAt: string;
  trip: { id: string; departureTime: string; route: { origin: string; destination: string } } | null;
  driver: { id: string; fullName: string } | null;
}

export interface FinanceSummary {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
  byCategory: Record<ExpenseCategory, number>;
}
