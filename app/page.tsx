// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
"use client";

// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81

// MECARDEE_BOOKING_QUICK_SCHEDULE_HANDOVER_WHATSAPP_V8_9_54

// MECARDEE_REMINDER_CUSTOMER_PLACE_STYLE_V8_9_80

// MECARDEE_LOCATION_REMINDERS_GUEST_OWNER_V8_9_79

// MECARDEE_CAPITALIZED_USERNAME_GREETING_V8_9_77

// MECARDEE_SESSION_USERNAME_GREETING_V8_9_76

// MECARDEE_GOOGLE_STYLE_HARD_RELOAD_V8_9_74

// MECARDEE_MOBILE_LOGOUT_REFRESH_ENCODING_V8_9_73

// MECARDEE_CUSTOMER_REPORT_DATES_LOGOUT_V8_9_70

// MECARDEE_CUSTOMER_HISTORY_SUPERADMIN_DELETE_V8_9_65

// MECARDEE_REPORTS_MOBILE_FILTER_FIELDS_V8_9_62

// MECARDEE_REPORTS_CUSTOMER_QUICKCREATE_V8_9_59

// MECARDEE_USER_ROLES_V8_9_55

// MECARDEE_MOBILE_SETTINGS_REMINDERS_CURRENT_RENTAL_V8_9_51

// MECARDEE_SETTINGS_SOFT_BOOKING_OVERLAP_V8_9_48

// MECARDEE_CHANGE_VEHICLE_USAGE_FUEL_PREVIEW_V8_9_43

// MECARDEE_SOFT_BOOKING_CONFLICTS_V8_9_42

// MECARDEE_DASHBOARD_CALENDAR_POPUP_V8_9_39

// MECARDEE_CALENDAR_RENTED_COLOUR_V8_9_38

// MECARDEE_FLEET_STATUS_MOBILE_FIT_V8_9_37

// MECARDEE_DEFAULT_RENTAL_DAYS_1_V8_9_35

// MECARDEE_BOOKING_CONFLICT_AFTER_REQUESTED_VEHICLE_V8_9_33

// MECARDEE_GUEST_CARS_MULTI_VEHICLE_V8_9_30

// MECARDEE_BOOKING_REPLACEMENT_MOBILE_COMPACT_V8_9_31

// MECARDEE_RESTORE_RENTAL_EDIT_CUSTOMER_DELETE_V8_9_26

// MECARDEE_CUSTOMER_DELETE_DUPLICATE_PHONE_V8_9_22

// MECARDEE_AUTO_PORTRAIT_VEHICLE_PHOTOS_V8_9_21

// MECARDEE_CURRENT_RENTAL_BALANCE_LABEL_V8_9_20

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { calculateExpectedReturnKilometer, calculateLateRentalCharge, calculateRentalChargeForActualReturn, calculateSettlement } from "@/lib/rental-calculations";
import { calculateSegmentCharge } from "@/lib/rental-segments";
import VehicleDetailsClient, { type VehicleProfilePayload } from "@/app/vehicles/[id]/vehicle-details-client";
import { compressVehicleImage } from "@/lib/client-image";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Fuel,
  Gauge,
  IndianRupee,
  LayoutDashboard,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  RotateCcw,
  Search,
  History,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trash2,
  UserRound,
  UserRoundPlus,
  UsersRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

const pdfMakeClient = pdfMake as any;
if (typeof pdfMakeClient.addVirtualFileSystem === "function") pdfMakeClient.addVirtualFileSystem(pdfFonts);
else pdfMakeClient.vfs = pdfFonts;

type View = "dashboard" | "rentals" | "bookings" | "vehicles" | "guest-cars" | "customers" | "payments" | "accounts" | "reports" | "settings";
type UserRole = "superadmin" | "owner" | "viewer";
type AuthUser = { id: string; username: string; role: UserRole };
type DialogType = null | "new-rental" | "new-booking" | "booking-detail" | "booking-start" | "booking-history-detail" | "booking-edit" | "rental-detail" | "pending-payments" | "payment" | "extend" | "change-vehicle" | "return" | "expense" | "vehicle" | "guest-vehicle" | "vehicle-detail" | "customer" | "customer-edit";
type RentalState = "active" | "today" | "overdue" | "completed";

type RentalSegmentRow = {
  id: string;
  sequence: number;
  vehicleId: string;
  vehicle: string;
  plate: string;
  image: string;
  isGuest: boolean;
  startAt: string;
  endAt: string | null;
  start: string;
  end: string;
  startingKilometer: number;
  endingKilometer: number | null;
  startingFuelRangeKm: number;
  returnFuelRangeKm: number | null;
  fuelRangeShortageKm: number;
  fuelPricePerLitre: number;
  fuelCharge: number;
  dailyRate: number;
  rentalDays: number;
  rentalCharge: number;
  extraKilometers: number;
  extraKmCharge: number;
  status: string;
};

type Rental = {
  id: string;
  databaseId: string;
  vehicleId: string;
  customerId: string;
  vehicle: string;
  plate: string;
  image: string;
  isGuestCurrent: boolean;
  originalVehicleId: string;
  originalVehicle: string;
  originalPlate: string;
  originalStartAt: string;
  originalEndAt: string;
  originalDays: number;
  replacementUsed: boolean;
  segments: RentalSegmentRow[];
  customer: string;
  phone: string;
  whatsappNumber: string;
  licence: string;
  start: string;
  returnDate: string;
  startAt: string;
  endAt: string;
  actualReturnAt: string | null;
  days: number;
  rate: number;
  rentalAmount: number;
  bookingDiscount: number;
  otherCharges: number;
  lateRentalDays: number;
  lateRentalCharge: number;
  total: number;
  businessFinancialTotal: number;
  guestRentalAmount: number;
  businessPaid: number;
  businessBalance: number;
  paid: number;
  balance: number;
  securityDeposit: number;
  state: RentalState;
  statusText: string;
  progress: number;
  startingKilometer: number;
  startingFuelRangeKm: number;
  allowedKmPerDay: number;
  extraKmRate: number;
  mileageKmPerLitre: number;
};

type Reservation = {
  id: string;
  bookingNumber: string;
  vehicleId: string;
  vehicle: string;
  plate: string;
  image: string;
  requestedVehicleId: string;
  requestedVehicle: string;
  requestedPlate: string;
  replacementBooked: boolean;
  customerId: string;
  customer: string;
  phone: string;
  whatsappNumber: string;
  city: string;
  startAt: string;
  endAt: string;
  start: string;
  returnDate: string;
  days: number;
  rate: number;
  amount: number;
  createdAt: string;
};

type BookingRecord = {
  id: string;
  bookingNumber: string;
  vehicleId: string;
  vehicle: string;
  plate: string;
  image: string;
  requestedVehicleId: string;
  requestedVehicle: string;
  requestedPlate: string;
  replacementBooked: boolean;
  customerId: string;
  customer: string;
  phone: string;
  whatsappNumber: string;
  city: string;
  startAt: string;
  endAt: string;
  start: string;
  returnDate: string;
  days: number;
  rate: number;
  amount: number;
  advancePaid: number;
  paid: number;
  balance: number;
  status: string;
  createdAt: string;
};

type Vehicle = {
  id: string;
  name: string;
  make: string;
  plate: string;
  image: string;
  fuel: string;
  transmission: string;
  year: number;
  rate: number;
  odometer: string;
  odometerKm: number;
  status: string;
  statusKey: string;
  note: string;
  docs: string;
  allowedKmPerDay: number;
  extraKmRate: number;
  mileageKmPerLitre: number;
  isGuest: boolean;
  guestOwnerName: string;
  guestOwnerPlace: string;
};

type SettlementSegmentRow = {
  sequence: number;
  vehicleId: string;
  vehicleName: string;
  registrationNumber: string;
  isGuest: boolean;
  bookingStart: string;
  bookingEnd: string;
  startAt: string;
  endAt: string;
  startingKilometer: number;
  endingKilometer: number | null;
  rentalDays: number;
  rentalCharge: number;
  extraKmCharge: number;
  fuelRangeShortageKm: number;
  fuelCharge: number;
};

type SettlementResult = {
  settlementId: string;
  bookingNumber: string;
  vehicleStatus: "available" | "maintenance";
  calculation: ReturnType<typeof calculateSettlement>;
  segments?: SettlementSegmentRow[];
  whatsappMessage: string;
  whatsappUrl: string;
};

type CustomerRow = {
  id: string; name: string; initials: string; phone: string; whatsappNumber: string; city: string; licence: string; fullLicence: string; rentals: number; spent: number; pending: number; active: string | null; activeRentalId: string | null; createdAt: string;
};

type PaymentRow = {
  id: string; customer: string; phone: string; rental: string; date: string; receivedAt: string; amount: number; actualAmount?: number; method: string; type: string; receivedBy: string; notes: string | null;
};

type ExpenseRow = {
  id: string; rawDate: string; date: string; category: string; vehicle: string; vehicleId: string | null; bookingId: string | null; description: string; method: string; amount: number; createdBy: string;
};

type ManagedPaymentTransaction = {
  id: string; number: string; bookingNumber: string; bookingId: string; customer: string; customerId: string; amount: number; method: string; type: string; notes: string | null; receivedBy: string; receivedAt: string;
};

type ManagedExpenseTransaction = {
  id: string; number: string; expenseDate: string; category: string; vehicle: string; plate: string; vehicleId: string | null; bookingId: string | null; amount: number; description: string | null; method: string; createdBy: string; createdAt: string;
};

type DeletedTransactionHistory = {
  id: string; transactionType: "payment" | "expense"; transactionId: string; transactionNumber: string; displayLabel: string; reason: string; deletedBy: string; deletedAt: string; restoredAt: string | null; restoredBy: string | null;
};

type TransactionManagerData = {
  ok: boolean; error?: string; payments: ManagedPaymentTransaction[]; expenses: ManagedExpenseTransaction[]; history: DeletedTransactionHistory[];
};

type ReminderRow = { key: string; tone: string; type: string; title: string; text: string; rentalId?: string; reservationId?: string };
type NotificationHistoryItem = ReminderRow & { readAt: string };

type Metrics = {
  totalCars: number; availableCars: number; onRentCars: number; maintenanceCars: number; roadReadyPercent: number; activeRentals: number; returningToday: number; overdue: number; outstanding: number; outstandingRentals: number; outstandingCustomers: number; totalCustomers: number; newCustomersThisMonth: number; currentlyRentingCustomers: number; collectedToday: number; paymentsToday: number; expensesToday: number; netToday: number; collectedMonth: number; collectedLastMonth: number; collectionChangePercent: number; rentalRevenueMonth: number; expensesMonth: number; netIncomeMonth: number; depositsHeld: number; twelveMonthCollected: number; monthlyCollected: { key: string; label: string; amount: number }[];
};

type AppSnapshot = { ok: boolean; error?: string; rentals: Rental[]; reservations: Reservation[]; bookings: BookingRecord[]; vehicles: Vehicle[]; guestVehicles: Vehicle[]; vehicleProfiles: Record<string, VehicleProfilePayload>; customers: CustomerRow[]; payments: PaymentRow[]; expenses: ExpenseRow[]; reminders: ReminderRow[]; metrics: Metrics };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type ReportType = "rentals" | "payments" | "expenses" | "outstanding" | "cars" | "customers";

const emptyMetrics: Metrics = { totalCars: 0, availableCars: 0, onRentCars: 0, maintenanceCars: 0, roadReadyPercent: 0, activeRentals: 0, returningToday: 0, overdue: 0, outstanding: 0, outstandingRentals: 0, outstandingCustomers: 0, totalCustomers: 0, newCustomersThisMonth: 0, currentlyRentingCustomers: 0, collectedToday: 0, paymentsToday: 0, expensesToday: 0, netToday: 0, collectedMonth: 0, collectedLastMonth: 0, collectionChangePercent: 0, rentalRevenueMonth: 0, expensesMonth: 0, netIncomeMonth: 0, depositsHeld: 0, twelveMonthCollected: 0, monthlyCollected: [] };

const navItems: { label: string; view: View; icon: LucideIcon; badge?: string }[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Rentals", view: "rentals", icon: CalendarRange, badge: "3" },
  { label: "Bookings", view: "bookings", icon: CalendarDays },
  { label: "Vehicles", view: "vehicles", icon: CarFront },
  { label: "Guest Cars", view: "guest-cars", icon: RotateCcw },
  { label: "Customers", view: "customers", icon: UsersRound },
  { label: "Expenses & Payments", view: "payments", icon: WalletCards },
  { label: "Accounts", view: "accounts", icon: BarChart3 },
  { label: "Reports", view: "reports", icon: FileText },
  { label: "Settings", view: "settings", icon: Settings2 },
];

const CURRENT_USER_NAME = "Admin";
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function dateInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function indiaDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function formatIndiaWhen(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(value));
}

function indiaDateTimeParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${map.hour}:${map.minute}` };
}

function periodsOverlap(startA: string | Date, endA: string | Date, startB: string | Date, endB: string | Date) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return Number.isFinite(aStart) && Number.isFinite(aEnd) && Number.isFinite(bStart) && Number.isFinite(bEnd) && aStart < bEnd && aEnd > bStart;
}

function findVehiclePeriodConflict(
  vehicleId: string,
  startAt: string | Date,
  endAt: string | Date,
  bookings: BookingRecord[],
  rentals: Rental[],
  excludeBookingId?: string,
) {
  const booking = bookings.find((item) =>
    item.id !== excludeBookingId &&
    item.status === "booked" &&
    item.vehicleId === vehicleId &&
    periodsOverlap(item.startAt, item.endAt, startAt, endAt)
  );
  if (booking) return { type: "booking" as const, label: booking.bookingNumber, customer: booking.customer };

  const requestedEnd = new Date(endAt).getTime();
  const rental = rentals.find((item) =>
    item.state !== "completed" &&
    item.databaseId !== excludeBookingId &&
    item.segments.some((segment) =>
      segment.status === "active" &&
      segment.vehicleId === vehicleId &&
      new Date(segment.startAt).getTime() < requestedEnd
    )
  );
  if (rental) return { type: "rental" as const, label: rental.id, customer: rental.customer };
  return null;
}

function availableReplacementVehicles(
  vehicles: Vehicle[],
  startAt: string | Date,
  _plannedEndAt: string | Date,
  bookings: BookingRecord[],
  rentals: Rental[],
  excludeVehicleId?: string,
  excludeBookingId?: string,
) {
  // A replacement only needs to be free when this segment STARTS. It may have
  // a future booking later in the customer's rental; staff can Change Vehicle
  // again before that booking. This is what enables 3+ vehicle segments while
  // preserving every future booking.
  const start = new Date(startAt);
  const assignmentEnd = new Date(start.getTime() + 1);
  return vehicles.filter((vehicle) =>
    vehicle.id !== excludeVehicleId &&
    !["inactive", "maintenance"].includes(vehicle.statusKey) &&
    !findVehiclePeriodConflict(vehicle.id, start, assignmentEnd, bookings, rentals, excludeBookingId)
  );
}

function availableBookingVehicles(
  vehicles: Vehicle[],
  startAt: string | Date,
  endAt: string | Date,
  bookings: BookingRecord[],
  rentals: Rental[],
  excludeVehicleId?: string,
  excludeBookingId?: string,
) {
  // A booking reserves the chosen vehicle for the complete booked period.
  // Only conflict-free alternatives are offered here.
  return vehicles.filter((vehicle) =>
    vehicle.id !== excludeVehicleId &&
    !["inactive", "maintenance"].includes(vehicle.statusKey) &&
    !findVehiclePeriodConflict(vehicle.id, startAt, endAt, bookings, rentals, excludeBookingId)
  );
}

function bookingNeedsVehicleChangeOnDate(booking: BookingRecord, dayKey: string, bookings: BookingRecord[], rentals: Rental[]) {
  if (!["booked", "rented"].includes(booking.status)) return false;
  const dayStart = new Date(`${dayKey}T00:00:00+05:30`).getTime();
  const dayEnd = new Date(`${dayKey}T23:59:59.999+05:30`).getTime();
  const collisionTouchesDay = (startA: string, endA: string, startB: string, endB: string) => {
    const overlapStart = Math.max(new Date(startA).getTime(), new Date(startB).getTime());
    const overlapEnd = Math.min(new Date(endA).getTime(), new Date(endB).getTime());
    return Number.isFinite(overlapStart) && Number.isFinite(overlapEnd) && overlapStart < overlapEnd && overlapStart <= dayEnd && overlapEnd > dayStart;
  };

  if (booking.status === "booked") {
    const bookingCollision = bookings.some((other) =>
      other.id !== booking.id &&
      other.status === "booked" &&
      other.vehicleId === booking.vehicleId &&
      collisionTouchesDay(booking.startAt, booking.endAt, other.startAt, other.endAt)
    );
    if (bookingCollision) return true;

    return rentals.some((rental) =>
      rental.state !== "completed" &&
      rental.vehicleId === booking.vehicleId &&
      collisionTouchesDay(booking.startAt, booking.endAt, rental.startAt, rental.endAt)
    );
  }

  const activeRental = rentals.find((rental) => rental.databaseId === booking.id && rental.state !== "completed");
  if (!activeRental) return false;
  return bookings.some((other) =>
    other.id !== booking.id &&
    other.status === "booked" &&
    other.vehicleId === activeRental.vehicleId &&
    collisionTouchesDay(activeRental.startAt, activeRental.endAt, other.startAt, other.endAt)
  );
}

const blankZero = (value: number) => value === 0 ? "" : value;
const numberFromInput = (value: string) => value === "" ? 0 : Number(value);
const selectZeroOnFocus = (event: React.FocusEvent<HTMLInputElement>) => {
  if (event.currentTarget.value === "0") event.currentTarget.select();
};
const numericKeyOnly = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
};

async function readApiResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) {
    throw new Error(`Server returned ${response.status} ${response.statusText || "without a response body"}.`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    const message = raw.replace(/\s+/g, " ").trim().slice(0, 320);
    throw new Error(message || `Server returned ${response.status} ${response.statusText}.`);
  }
}

async function mecardeeQuickLogout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.reload();
}

export default function Home() {
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [dialog, setDialog] = useState<DialogType>(null);
  const [rentalList, setRentalList] = useState<Rental[]>([]);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [guestVehicleList, setGuestVehicleList] = useState<Vehicle[]>([]);
  const [reservationList, setReservationList] = useState<Reservation[]>([]);
  const [bookingList, setBookingList] = useState<BookingRecord[]>([]);
  const [vehicleProfiles, setVehicleProfiles] = useState<Record<string, VehicleProfilePayload>>({});
  const [customerList, setCustomerList] = useState<CustomerRow[]>([]);
  const [paymentList, setPaymentList] = useState<PaymentRow[]>([]);
  const [expenseList, setExpenseList] = useState<ExpenseRow[]>([]);
  const [expenseSeedRentalId, setExpenseSeedRentalId] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [selectedBookingRecord, setSelectedBookingRecord] = useState<BookingRecord | null>(null);
  const [bookingSeed, setBookingSeed] = useState<{ vehicleId: string; date: string } | null>(null);
  const [rentalSeedVehicleId, setRentalSeedVehicleId] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleEditOnOpen, setVehicleEditOnOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<string[]>([]);
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistoryItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileQuickCreateOpen, setMobileQuickCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installBannerVisible, setInstallBannerVisible] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = await readApiResponse<{ ok: boolean; user?: AuthUser | null }>(response);
        if (!cancelled && response.ok && payload.user) setSessionUser(payload.user);
      } catch {
        // Login screen will be shown.
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      const payload = await readApiResponse<AppSnapshot>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load live database data.");
      setRentalList(payload.rentals);
      setReservationList(payload.reservations ?? []);
      setBookingList(payload.bookings ?? []);
      setVehicleList(payload.vehicles);
      setGuestVehicleList(payload.guestVehicles ?? []);
      setVehicleProfiles(payload.vehicleProfiles ?? {});
      setCustomerList(payload.customers);
      setPaymentList(payload.payments);
      setExpenseList(payload.expenses);
      setReminders(payload.reminders);
      setMetrics(payload.metrics);
      setLastSyncedAt(new Date());
      setSelectedRental((current) => current ? payload.rentals.find((rental) => rental.id === current.id) ?? payload.rentals[0] ?? null : payload.rentals[0] ?? null);
    } catch (error) {
      console.error(error);
      if (!options?.silent) showToast(error instanceof Error ? error.message : "Could not load live database data.");
    }
  }, [showToast]);

  useEffect(() => { if (!sessionUser) return; void refreshData(); }, [refreshData, sessionUser]);

  // MECARDEE_MOBILE_LAST_EDITS_V8_9_23
  useEffect(() => {
    try {
      const seen = JSON.parse(localStorage.getItem("mecardee-notifications-seen-v1") || "[]");
      const read = JSON.parse(localStorage.getItem("mecardee-notifications-read-v1") || "[]");
      const history = JSON.parse(localStorage.getItem("mecardee-notifications-history-v1") || "[]");
      if (Array.isArray(seen)) setSeenNotificationKeys((seen as unknown[]).filter((value): value is string => typeof value === "string").slice(-200));
      if (Array.isArray(read)) setReadNotificationKeys((read as unknown[]).filter((value): value is string => typeof value === "string").slice(-200));
      if (Array.isArray(history)) setNotificationHistory((history as NotificationHistoryItem[]).slice(0, 10));
    } catch {
      localStorage.removeItem("mecardee-notifications-seen-v1");
      localStorage.removeItem("mecardee-notifications-read-v1");
      localStorage.removeItem("mecardee-notifications-history-v1");
    }
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && notificationRef.current && !notificationRef.current.contains(target)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [notificationsOpen]);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const dismissedThisSession = () => sessionStorage.getItem("mecardee-install-dismissed-session") === "1";

    // v8 used a permanent localStorage dismissal. Clear that old flag once so Android users
    // who dismissed the early version are eligible to see the improved prompt again.
    localStorage.removeItem("mecardee-install-dismissed");

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch((error) => console.warn("Service worker registration failed", error));
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      if (!isStandalone && !dismissedThisSession()) setInstallBannerVisible(true);
    };
    const onInstalled = () => {
      setInstallBannerVisible(false);
      setInstallPrompt(null);
      sessionStorage.removeItem("mecardee-install-dismissed-session");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // Chrome can delay beforeinstallprompt until its engagement checks are satisfied.
    // Still show our own small website banner on Android so the install option is discoverable.
    const fallbackTimer = window.setTimeout(() => {
      if (isAndroid && !isStandalone && !dismissedThisSession()) setInstallBannerVisible(true);
    }, 4500);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const vehicleResults = vehicleList.filter((v) => `${v.name} ${v.plate}`.toLowerCase().includes(query)).map((v) => ({ type: "Vehicle", title: v.name, meta: `${v.plate} · ${v.status}`, action: () => openVehicle(v) }));
    const guestResults = guestVehicleList.filter((v) => `${v.name} ${v.plate}`.toLowerCase().includes(query)).map((v) => ({ type: "Guest Car", title: v.name, meta: `${v.plate} · ${v.status}`, action: () => openVehicle(v) }));
    const customerResults = customerList.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query)).map((c) => ({ type: "Customer", title: c.name, meta: `${c.phone} · ${c.rentals} rentals`, action: () => goTo("customers") }));
    const rentalResults = rentalList.filter((r) => `${r.id} ${r.vehicle} ${r.plate} ${r.customer}`.toLowerCase().includes(query)).map((r) => ({ type: "Rental", title: r.id, meta: `${r.vehicle} · ${r.customer}`, action: () => openRental(r) }));
    const bookingResults = bookingList.filter((r) => `${r.bookingNumber} ${r.vehicle} ${r.plate} ${r.customer} ${r.phone}`.toLowerCase().includes(query)).map((r) => ({ type: "Booking", title: r.bookingNumber, meta: `${r.vehicle} · ${r.customer}`, action: () => openBookingRecord(r) }));
    return [...vehicleResults, ...guestResults, ...customerResults, ...rentalResults, ...bookingResults].slice(0, 6);
  }, [search, rentalList, bookingList, vehicleList, guestVehicleList, customerList]);

  function markCurrentNotificationsSeen() {
    const keys = reminders.map((reminder) => reminder.key);
    if (!keys.length) return;
    setSeenNotificationKeys((current) => {
      const next = Array.from(new Set([...current, ...keys])).slice(-200);
      localStorage.setItem("mecardee-notifications-seen-v1", JSON.stringify(next));
      return next;
    });
  }

  function openNotificationsPanel() {
    markCurrentNotificationsSeen();
    setNotificationsOpen(true);
  }

  function toggleNotificationsPanel() {
    if (notificationsOpen) { setNotificationsOpen(false); return; }
    openNotificationsPanel();
  }

  function markNotificationRead(reminder: ReminderRow) {
    setSeenNotificationKeys((current) => {
      const next = Array.from(new Set([...current, reminder.key])).slice(-200);
      localStorage.setItem("mecardee-notifications-seen-v1", JSON.stringify(next));
      return next;
    });
    setReadNotificationKeys((current) => {
      const next = Array.from(new Set([...current, reminder.key])).slice(-200);
      localStorage.setItem("mecardee-notifications-read-v1", JSON.stringify(next));
      return next;
    });
    setNotificationHistory((current) => {
      const next = [{ ...reminder, readAt: new Date().toISOString() }, ...current.filter((item) => item.key !== reminder.key)].slice(0, 10);
      localStorage.setItem("mecardee-notifications-history-v1", JSON.stringify(next));
      return next;
    });
  }

  function goTo(next: View) {
    setView(next);
    setMobileMenuOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "auto" });
    void refreshData({ silent: true });
  }

  function openRental(rental: Rental) {
    setSelectedRental(rental);
    setDialog("rental-detail");
    setSearch("");
  }

  function openVehicle(vehicle: Vehicle, edit = false) {
    setSelectedVehicle(vehicle);
    setVehicleEditOnOpen(edit);
    setDialog("vehicle-detail");
    setSearch("");
  }

  function openNewRental(vehicleId?: string) {
    // VIEWER_GUARD_openNewRental
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    void refreshData({ silent: true });
    setRentalSeedVehicleId(vehicleId ?? null);
    setDialog("new-rental");
    setSearch("");
  }

  function openBookingForVehicle(vehicleId: string, date: string) {
    // VIEWER_GUARD_openBookingForVehicle
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    void refreshData({ silent: true });
    setBookingSeed({ vehicleId, date });
    setDialog("new-booking");
    setSearch("");
  }

  function openReservation(reservation: Reservation) {
    setSelectedReservation(reservation);
    setDialog("booking-detail");
    setSearch("");
  }

  function openReservationById(reservationId: string) {
    const reservation = reservationList.find((item) => item.id === reservationId);
    if (reservation) openReservation(reservation);
  }

  function openBookingRecord(booking: BookingRecord) {
    setSearch("");
    if (booking.status === "booked") {
      const reservation = reservationList.find((item) => item.id === booking.id);
      if (reservation) return openReservation(reservation);
    }
    if (["rented", "completed"].includes(booking.status)) {
      const rental = rentalList.find((item) => item.id === booking.bookingNumber);
      if (rental) return openRental(rental);
    }
    setSelectedBookingRecord(booking);
    setDialog("booking-history-detail");
  }

  function editBookingRecord(booking: BookingRecord) {
    // VIEWER_GUARD_editBookingRecord
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    setSelectedBookingRecord(booking);
    setDialog("booking-edit");
    setSearch("");
  }

  function startBookingRecord(booking: BookingRecord) {
    // VIEWER_GUARD_startBookingRecord
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    const reservation = reservationList.find((item) => item.id === booking.id);
    if (!reservation) return showToast("This booking is no longer waiting to start.");
    if (Date.now() < new Date(booking.startAt).getTime()) return showToast("This booking has not reached its pickup time yet.");
    setSelectedReservation(reservation);
    setDialog("booking-start");
  }

  function newBookingFromTab() {
    // VIEWER_GUARD_newBookingFromTab
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    void refreshData({ silent: true });
    setBookingSeed({ vehicleId: "", date: dateInputValue(new Date()) });
    setDialog("new-booking");
    setSearch("");
  }

  function sendBookingRecordWhatsApp(booking: BookingRecord) {
    const digits = (booking.whatsappNumber || booking.phone).replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits.startsWith("0") && digits.length === 11 ? `91${digits.slice(1)}` : digits;
    const label = booking.status === "cancelled" ? "Booking update" : "Booking confirmation";
    const text = `Mecardee Rental — ${label}\n\nHello ${booking.customer},\n\nVehicle: ${booking.vehicle} (${booking.plate})\nBooking: ${booking.bookingNumber}\nPickup: ${booking.start}\nExpected return: ${booking.returnDate}\nRental days: ${booking.days}\nBooking amount: ${money(booking.amount)}\nAdvance: ${money(booking.advancePaid)}\nStatus: ${booking.status.replaceAll("_", " ")}\n\nPlease reply if any detail needs correction.`;
    openWhatsAppSafely(phone, text);
  }

  function openCustomerEdit(customer: CustomerRow) {
    // VIEWER_GUARD_openCustomerEdit
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    setSelectedCustomer(customer);
    setDialog("customer-edit");
    setSearch("");
  }

  async function deleteCustomer(customer: CustomerRow) {
    // VIEWER_GUARD_deleteCustomer
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    const confirmed = window.confirm(`Delete ${customer.name}?\n\nThis will permanently remove the customer and any booking-only reservations linked to them. Customers with rental history cannot be deleted. This cannot be undone.`);
    if (!confirmed) return;
    try {
      const response = await fetch("/api/customers/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: customer.id }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string } }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not delete customer.");
      if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
      showToast(`${payload.customer?.name ?? customer.name} deleted from customers`);
      await refreshData({ silent: true });
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : "Could not delete customer.");
    }
  }

  function openRentalById(rentalId: string) {
    const rental = rentalList.find((item) => item.id === rentalId);
    if (rental) openRental(rental);
  }

  function openPayment() {
    // VIEWER_GUARD_openPayment
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    const rental = [...rentalList].filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance)[0];
    if (!rental) return showToast("There are no outstanding rental balances.");
    setSelectedRental(rental);
    setDialog("payment");
  }

  // MECARDEE_IPHONE_WHATSAPP_FIX_V8_9_27
  // MECARDEE_IPHONE_WHATSAPP_NO_POPUP_V8_9_29
  function openExpense(rentalId?: string | null) {
    if (sessionUser?.role === "viewer") { showToast("Viewer access is read-only."); return; }
    setExpenseSeedRentalId(rentalId ?? null);
    setDialog("expense");
  }
  function openWhatsAppSafely(phone: string, text: string) {
    const encodedText = encodeURIComponent(text);
    const webUrl = `https://wa.me/${phone}?text=${encodedText}`;

    const isIOS =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      // iPhone/iPad: use the normal HTTPS universal link in the CURRENT tab.
      // This avoids both a blank new tab and the repeated external-app warning.
      window.location.href = webUrl;
      return;
    }

    // Android and desktop keep the existing new-tab behaviour.
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }

  function sendWhatsApp(rental: Rental, purpose = "rental reminder") {
    const digits = (rental.whatsappNumber || rental.phone).replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits.startsWith("0") && digits.length === 11 ? `91${digits.slice(1)}` : digits;
    const text = `Mecardee Rental — ${purpose}\n\nCustomer: ${rental.customer}\nVehicle: ${rental.vehicle} (${rental.plate})\nBooking: ${rental.id}\nExpected return: ${rental.returnDate}\nBalance due: ${money(rental.balance)}`;
    openWhatsAppSafely(phone, text);
  }

  // MECARDEE_REMINDER_NO_ESTIMATED_RENT_V8_9_41
  // MECARDEE_REMINDER_DAILY_RATE_V8_9_51
  function sendBookingWhatsApp(reservation: Reservation, purpose: "confirmation" | "reminder" = "confirmation") {
    const digits = (reservation.whatsappNumber || reservation.phone).replace(/\D/g, "");
    const phone =
      digits.length === 10
        ? `91${digits}`
        : digits.startsWith("0") && digits.length === 11
          ? `91${digits.slice(1)}`
          : digits;

    const isReminder = purpose === "reminder";
    const label = isReminder ? "Upcoming booking reminder" : "Booking confirmation";
    const intro = isReminder
      ? "This is a reminder for your upcoming vehicle booking."
      : "Your vehicle booking is reserved.";
    const closing = isReminder
      ? "Please reply to confirm that the pickup details are still correct."
      : "Please reply to confirm the booking details.";

    // Reminder: show the booked PER-DAY rate, but no estimated total.
    // Confirmation: keep the existing estimated total behaviour.
    const priceLine = isReminder
      ? `\nPer day rent: ${money(reservation.rate)}`
      : `\nEstimated rent: ${money(reservation.amount)}`;

    const text =
      `Mecardee Rental - ${label}\n\n` +
      `Hello ${reservation.customer},\n` +
      `${intro}\n\n` +
      `Vehicle: ${reservation.vehicle} (${reservation.plate})\n` +
      `Booking: ${reservation.bookingNumber}\n` +
      `Pickup: ${reservation.start}\n` +
      `Expected return: ${reservation.returnDate}\n` +
      `Rental days: ${reservation.days}` +
      priceLine +
      `\n\n${closing}`;

    openWhatsAppSafely(phone, text);
  }

  function exportPayments() {
    if (!paymentList.length) return showToast("No payments to export.");
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Payment", "Customer", "Rental", "Date", "Method", "Amount", "Received by"], ...paymentList.map((payment) => [payment.id, payment.customer, payment.rental, payment.date, payment.method, payment.amount, payment.receivedBy])];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `mecardee-payments-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function handleUserLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await readApiResponse<{ ok: boolean; user?: AuthUser; error?: string }>(response);
      if (!response.ok || !payload.user) throw new Error(payload.error || "Incorrect username or password.");
      setSessionUser(payload.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Incorrect username or password.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setSessionUser(null);
    setRentalList([]);
    setReservationList([]);
    setBookingList([]);
    setVehicleList([]);
    setGuestVehicleList([]);
    setCustomerList([]);
    setPaymentList([]);
    setExpenseList([]);
    setReminders([]);
    setView("dashboard");
  }

  async function manualSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await refreshData();
    } finally {
      setSyncing(false);
    }
  }

  // MECARDEE_SETTINGS_INPLACE_SYNC_V8_9_53
  // Settings-only sync: fetch the newest database snapshot without navigating
  // away from Settings or reloading the browser page.
  async function settingsSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await refreshData();
    } finally {
      setSyncing(false);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      showToast("In Chrome, tap ⋮ and choose Install app / Add to Home screen.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallBannerVisible(false);
      setInstallPrompt(null);
      showToast("Mecardee installed");
    }
  }

  function dismissInstallPrompt() {
    sessionStorage.setItem("mecardee-install-dismissed-session", "1");
    setInstallBannerVisible(false);
  }

  function handleSettlementConfirmed(result: SettlementResult) {
    showToast(`Return settlement ${result.bookingNumber} confirmed`);
    void refreshData();
  }

  if (!authReady) {
    return <main className="mecardee-auth-screen mecardee-auth-screen-bootstrap" aria-busy="true" />;
  }
  if (!sessionUser) {
    return (
      <main className="mecardee-auth-screen">
        <section className="mecardee-auth-card">
          <div className="brand-mark mecardee-auth-logo">M</div>
          <span className="eyebrow">MECARDEE RENTAL</span>
          <h1>Welcome back</h1>
          <p>Sign in to continue to Rental Manager.</p>
          <form className="mecardee-auth-form" onSubmit={handleUserLogin}>
            <label><span>Username</span><input name="username" autoComplete="username" autoCapitalize="none" required autoFocus /></label>
            <label><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
            {authError && <p className="mecardee-auth-error">{authError}</p>}
            <button className="primary-button" type="submit" disabled={authBusy}>{authBusy ? "Signing in..." : "Sign in"}</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell" data-user-role={sessionUser.role} onKeyDownCapture={(event) => {
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement;
      if (!target.closest("form")) return;
      if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
      if (target.tagName === "INPUT" || target.tagName === "SELECT") event.preventDefault();
    }}>
      <Sidebar view={view} goTo={goTo} metrics={metrics} bookings={bookingList} />
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu size={21} /></button>
          <div className="mobile-brand"><span className="brand-mark">M</span><strong>Mecardee</strong></div>
          <div className="search-wrap desktop-search-wrap">
            <label className="global-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search car, customer or rental ID" /><kbd>⌘ K</kbd></label>
            {search && <div className="search-results">
              <div className="search-caption">Search results</div>
              {searchResults.length ? searchResults.map((result, index) => <button key={`${result.type}-${index}`} onClick={result.action}><span className="result-icon">{result.type[0]}</span><span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight size={15} /></button>) : <div className="empty-search"><Search size={20} /><span>No matches for “{search}”</span></div>}
            </div>}
          </div>
          <div className="top-actions">
          <button className="top-logout-icon" type="button" onClick={() => void mecardeeQuickLogout()} aria-label="Log out" title="Log out"><svg className="mecardee-logout-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></svg></button>
            <button className="icon-button mobile-sync-button" onClick={() => void manualSync()} aria-label="Sync latest data"><RefreshCw size={18} className={syncing ? "spin" : ""} /></button>
            <div className="notification-wrap" ref={notificationRef}>
              <button className="icon-button" onClick={toggleNotificationsPanel} aria-label="Notifications"><Bell size={18} />{reminders.some((reminder) => !seenNotificationKeys.includes(reminder.key)) && <span className="notification-dot" />}</button>
              {notificationsOpen && <Notifications reminders={reminders} history={notificationHistory} readKeys={readNotificationKeys} onClose={() => setNotificationsOpen(false)} markRead={markNotificationRead} openRental={openRentalById} openReservation={openReservationById} />}
            </div>
            <button className="primary-button" onClick={() => openNewRental()}><Plus size={17} /> New rental</button>
          </div>
        </header>

        <div className="content">
          <div className="mobile-search-slot">
            <div className="search-wrap">
              <label className="global-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search car, customer or rental ID" /></label>
              {search && <div className="search-results">
                <div className="search-caption">Search results</div>
                {searchResults.length ? searchResults.map((result, index) => <button key={`${result.type}-${index}`} onClick={result.action}><span className="result-icon">{result.type[0]}</span><span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight size={15} /></button>) : <div className="empty-search"><Search size={20} /><span>No matches for “{search}”</span></div>}
              </div>}
            </div>
          </div>
          {view === "dashboard" && <Dashboard userName={sessionUser.username} rentals={rentalList} reservations={reservationList} bookings={bookingList} vehicles={vehicleList} metrics={metrics} reminders={reminders} openRental={openRental} openVehicle={openVehicle} openReservation={openReservation} openBooking={openBookingForVehicle} openNew={() => openNewRental()} openNewBooking={newBookingFromTab} openNotifications={openNotificationsPanel} openPendingPayments={() => setDialog("pending-payments")} goTo={goTo} sendWhatsApp={sendWhatsApp} sendBookingWhatsApp={sendBookingWhatsApp} />}
          {view === "rentals" && <RentalsView rentals={rentalList} metrics={metrics} openRental={openRental} openNew={() => openNewRental()} />}
          {view === "bookings" && <BookingsView bookings={bookingList} rentals={rentalList} vehicles={[...vehicleList, ...guestVehicleList]} openBooking={openBookingRecord} editBooking={editBookingRecord} startBooking={startBookingRecord} sendWhatsApp={sendBookingRecordWhatsApp} newBooking={newBookingFromTab} />}
          {view === "vehicles" && <VehiclesView vehicles={vehicleList} metrics={metrics} openNew={openNewRental} addVehicle={() => setDialog("vehicle")} openVehicle={openVehicle} showToast={showToast} />}
          {view === "guest-cars" && <GuestCarsView vehicles={guestVehicleList} rentals={rentalList} addVehicle={() => setDialog("guest-vehicle")} openVehicle={openVehicle} openRental={openRental} />}
          {view === "customers" && <CustomersView currentUser={sessionUser!} payments={paymentList} rentals={rentalList} customers={customerList} metrics={metrics} openNew={() => openNewRental()} openRentalById={openRentalById} addCustomer={() => setDialog("customer")} editCustomer={openCustomerEdit} deleteCustomer={deleteCustomer} />}
          {view === "payments" && <PaymentsView rentals={rentalList} payments={paymentList} metrics={metrics} openPayment={openPayment} openExpense={() => openExpense()} exportPayments={exportPayments} sendWhatsApp={sendWhatsApp} />}
          {view === "accounts" && <AccountsView expenses={expenseList} metrics={metrics} />}
          {view === "reports" && <ReportsView rentals={rentalList} payments={paymentList} expenses={expenseList} vehicles={vehicleList} />}
          {view === "settings" && <SettingsView rentals={rentalList} vehicles={[...vehicleList, ...guestVehicleList]} bookings={bookingList} lastSyncedAt={lastSyncedAt} syncing={syncing} onSync={() => void settingsSync()} currentUser={sessionUser!} onLogout={logout} />}
        </div>
      </main>

      <MobileNav view={view} goTo={goTo} openNew={() => sessionUser?.role === "viewer" ? showToast("Viewer access is read-only.") : setMobileQuickCreateOpen(true)} />
      {mobileQuickCreateOpen && <MobileQuickCreate
        close={() => setMobileQuickCreateOpen(false)}
        newRental={() => { setMobileQuickCreateOpen(false); openNewRental(); }}
        newBooking={() => { setMobileQuickCreateOpen(false); newBookingFromTab(); }}
      />}
      {installBannerVisible && <InstallAppPrompt ready={Boolean(installPrompt)} onInstall={() => void installApp()} onClose={dismissInstallPrompt} />}
      {mobileMenuOpen && <MobileMenu view={view} goTo={goTo} close={() => setMobileMenuOpen(false)} />}
      {dialog === "new-booking" && <NewBookingDialog vehicles={vehicleList} guestVehicles={guestVehicleList} customers={customerList} bookings={bookingList} rentals={rentalList} seed={bookingSeed} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} showToast={showToast} />}
      {dialog === "booking-detail" && selectedReservation && <BookingDetailDialog reservation={selectedReservation} canStart={Date.now() >= new Date(selectedReservation.startAt).getTime()} close={() => setDialog(null)} edit={() => { const bookingRecord = bookingList.find((item) => item.id === selectedReservation.id); if (!bookingRecord) { showToast("Could not load booking details."); return; } setSelectedBookingRecord(bookingRecord); setDialog("booking-edit"); }} start={() => setDialog("booking-start")} cancelled={(message) => { setDialog(null); setSelectedReservation(null); showToast(message); void refreshData(); }} />}
      {dialog === "booking-start" && selectedReservation && <StartBookingDialog reservation={selectedReservation} vehicle={[...vehicleList, ...guestVehicleList].find((item) => item.id === selectedReservation.vehicleId) ?? null} vehicles={vehicleList} guestVehicles={guestVehicleList} bookings={bookingList} rentals={rentalList} close={() => setDialog("booking-detail")} done={(message) => { setDialog(null); setSelectedReservation(null); showToast(message); void refreshData(); }} />}
      {dialog === "booking-history-detail" && selectedBookingRecord && <BookingHistoryDialog booking={selectedBookingRecord} close={() => { setDialog(null); setSelectedBookingRecord(null); }} sendWhatsApp={() => sendBookingRecordWhatsApp(selectedBookingRecord)} />}
      {dialog === "booking-edit" && selectedBookingRecord && <BookingEditDialog booking={selectedBookingRecord} vehicles={vehicleList} guestVehicles={guestVehicleList} bookings={bookingList} rentals={rentalList} close={() => { setDialog(null); setSelectedBookingRecord(null); }} done={(message) => { setDialog(null); setSelectedBookingRecord(null); showToast(message); void refreshData(); }} />}
      {dialog === "new-rental" && <NewRentalDialog vehicles={vehicleList} guestVehicles={guestVehicleList} bookings={bookingList} rentals={rentalList} customers={customerList} seedVehicleId={rentalSeedVehicleId} close={() => { setRentalSeedVehicleId(null); setDialog(null); }} done={(message) => { setRentalSeedVehicleId(null); setDialog(null); showToast(message); void refreshData(); }} showToast={showToast} />}
      {dialog === "rental-detail" && selectedRental && <RentalDetailDialog rental={selectedRental} close={() => setDialog(null)} switchDialog={setDialog} sendWhatsApp={sendWhatsApp} addExpense={() => openExpense(selectedRental.databaseId)} />}
      {dialog === "pending-payments" && <PendingPaymentsDialog rentals={rentalList} close={() => setDialog(null)} receive={(rental) => { setSelectedRental(rental); setDialog("payment"); }} />}
      {dialog === "payment" && selectedRental && <PaymentDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "extend" && selectedRental && <ExtendDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "change-vehicle" && selectedRental && <ChangeVehicleDialog rental={selectedRental} vehicles={vehicleList} guestVehicles={guestVehicleList} bookings={bookingList} rentals={rentalList} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "return" && selectedRental && <ReturnDialog rental={selectedRental} close={() => setDialog(null)} onConfirmed={handleSettlementConfirmed} sendSettlementWhatsApp={openWhatsAppSafely} />}
      {dialog === "customer" && <CustomerDialog customers={customerList} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "customer-edit" && selectedCustomer && <CustomerEditDialog customer={selectedCustomer} close={() => { setDialog(null); setSelectedCustomer(null); }} done={(message) => { setDialog(null); setSelectedCustomer(null); showToast(message); void refreshData(); }} />}
      {dialog === "vehicle" && <VehicleDialog close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "guest-vehicle" && <VehicleDialog guest close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "vehicle-detail" && selectedVehicle && <DialogShell title={selectedVehicle.name} subtitle={`${selectedVehicle.plate} · Vehicle profile`} close={() => setDialog(null)} wide><VehicleDetailsClient vehicleId={selectedVehicle.id} embedded startEditing={vehicleEditOnOpen} initialData={vehicleProfiles[selectedVehicle.id] ?? null} onChanged={() => void refreshData()} /></DialogShell>}
      {dialog === "expense" && <ExpenseDialog vehicles={[...vehicleList, ...guestVehicleList]} rentals={rentalList} seedRentalId={expenseSeedRentalId} currentUser={sessionUser} close={() => { setExpenseSeedRentalId(null); setDialog(null); }} done={(message) => { setExpenseSeedRentalId(null); setDialog(null); showToast(message); void refreshData(); }} />}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast}</span></div>}
    </div>
  );
}

function Sidebar({ view, goTo, metrics, bookings }: { view: View; goTo: (view: View) => void; metrics: Metrics; bookings: BookingRecord[] }) {
  const today = indiaDateKey(new Date());
  const upcomingBookings = bookings.filter((booking) => booking.status === "booked" && indiaDateKey(booking.endAt) >= today).length;
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div>
    <nav aria-label="Primary navigation">
      <span className="nav-label">WORKSPACE</span>
      {navItems.slice(0, 8).map((item) => { const Icon = item.icon; const badge = item.view === "rentals" && metrics.activeRentals > 0 ? String(metrics.activeRentals) : item.view === "bookings" && upcomingBookings > 0 ? String(upcomingBookings) : null; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span>{badge && <b>{badge}</b>}</button>; })}
      <span className="nav-label lower">INSIGHTS</span>
      {navItems.slice(8).map((item) => { const Icon = item.icon; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span></button>; })}
            <button className="nav-item sidebar-logout-action" type="button" onClick={() => void mecardeeQuickLogout()}><svg className="mecardee-logout-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></svg><span>Log out</span></button>
      </nav>
    <div className="sidebar-health"><div className="health-head"><span className="pulse" /><strong>Fleet health</strong><b>{metrics.roadReadyPercent}%</b></div><div className="health-bar"><span style={{ width: `${metrics.roadReadyPercent}%` }} /></div><small>{metrics.availableCars + metrics.onRentCars} of {metrics.totalCars} vehicles are road-ready</small></div>
  </aside>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</section>;
}

function reminderIcon(type: string): LucideIcon {
  if (type === "overdue") return AlertTriangle;
  if (type === "today") return Clock3;
  if (type === "payment") return IndianRupee;
  if (type === "document") return ShieldCheck;
  if (type === "booking") return CalendarRange;
  return Wrench;
}

function Dashboard({ userName, rentals, reservations, bookings, vehicles, metrics, reminders, openRental, openVehicle, openReservation, openBooking, openNew, openNewBooking, openNotifications, openPendingPayments, goTo, sendWhatsApp, sendBookingWhatsApp }: { userName: string; rentals: Rental[]; reservations: Reservation[]; bookings: BookingRecord[]; vehicles: Vehicle[]; metrics: Metrics; reminders: ReminderRow[]; openRental: (rental: Rental) => void; openVehicle: (vehicle: Vehicle) => void; openReservation: (reservation: Reservation) => void; openBooking: (vehicleId: string, date: string) => void; openNew: () => void; openNewBooking: () => void; openNotifications: () => void; openPendingPayments: () => void; goTo: (view: View) => void; sendWhatsApp: (rental: Rental, purpose?: string) => void; sendBookingWhatsApp: (reservation: Reservation, purpose?: "confirmation" | "reminder") => void }) {
  const focus = rentals.find((rental) => rental.state === "overdue") ?? rentals.find((rental) => rental.state === "today") ?? rentals.find((rental) => rental.state !== "completed");
  const [dashboardCalendarOpen, setDashboardCalendarOpen] = useState(false);
  // MECARDEE_DYNAMIC_GREETING_BUTTON_SIZE_V8_9_52
  // Greeting follows the browser/device local time.
  const dashboardDisplayName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : "User";
  const [dashboardGreeting, setDashboardGreeting] = useState(() => `Good morning, ${dashboardDisplayName}`);
  useEffect(() => {
    const updateDashboardGreeting = () => {
      const hour = new Date().getHours();
      setDashboardGreeting(
        hour < 12
          ? `Good morning, ${dashboardDisplayName}`
          : hour < 17
            ? `Good afternoon, ${dashboardDisplayName}`
            : `Good evening, ${dashboardDisplayName}`
      );
    };

    updateDashboardGreeting();
    const timer = window.setInterval(updateDashboardGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, [dashboardDisplayName]);
  const dateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date()).toUpperCase();
  // MECARDEE_BOOKING_PRIORITY_DASHBOARD_V8_9_17
  const bookingBriefNow = Date.now();
  // MECARDEE_SETTLED_PENDING_VALUE_V8_9_19
  const settledPendingAmount = rentals
    .filter((rental) => rental.state === "completed" && Number(rental.balance) > 0)
    .reduce((sum, rental) => sum + Number(rental.balance), 0);
  const activeBusinessRentals = rentals.filter((rental) => rental.state !== "completed" && Number(rental.businessFinancialTotal) > 0);
  const currentRentalAmount = activeBusinessRentals.reduce((sum, rental) => sum + Number(rental.businessFinancialTotal), 0);
  const upcomingBookings = reservations
    .filter((booking) => new Date(booking.endAt).getTime() >= bookingBriefNow)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const nearestBookings = upcomingBookings.slice(0, 3);
  const bookingMoment = (booking: Reservation) => {
    const startMs = new Date(booking.startAt).getTime();
    const dateKey = indiaDateKey(booking.startAt);
    const todayKey = indiaDateKey(new Date(bookingBriefNow));
    const tomorrowKey = indiaDateKey(new Date(bookingBriefNow + 86400000));
    const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(booking.startAt));
    if (startMs <= bookingBriefNow) return `Pickup due - ${time}`;
    if (dateKey === todayKey) return `Today - ${time}`;
    if (dateKey === tomorrowKey) return `Tomorrow - ${time}`;
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(booking.startAt));
  };
  const stats = [
    { label: "Total cars", shortLabel: "Cars", value: String(metrics.totalCars), note: "Registered fleet", icon: CarFront, tone: "neutral" },
    { label: "Available", shortLabel: "Free", value: String(metrics.availableCars), note: "Ready to rent", icon: CheckCircle2, tone: "green" },
    { label: "On rent", shortLabel: "Rent", value: String(metrics.onRentCars), note: "With customers", icon: CalendarDays, tone: "blue" },
    { label: "Returning today", shortLabel: "Return", value: String(metrics.returningToday), note: metrics.returningToday ? "Due today" : "Nothing due today", icon: Clock3, tone: "amber" },
    { label: "Overdue", shortLabel: "Late", value: String(metrics.overdue), note: metrics.overdue ? "Follow up now" : "No overdue rentals", icon: AlertTriangle, tone: "red" },
    { label: "Current rental amount", shortLabel: "Rental ₹", value: money(currentRentalAmount), note: `${activeBusinessRentals.length} active rental${activeBusinessRentals.length === 1 ? "" : "s"}`, icon: IndianRupee, tone: "money" },
  ];
  return <>
    <div className="dashboard-greeting"><PageHeading eyebrow={dateLabel} title={dashboardGreeting} description="Here’s what needs your attention today." action={<button type="button" className="dashboard-calendar-button" onClick={() => setDashboardCalendarOpen(true)} title="Open booking calendar"><CalendarDays size={15} /><span>Calendar</span></button>} /></div>
    {dashboardCalendarOpen && <DashboardBookingCalendar bookings={bookings} rentals={rentals} close={() => setDashboardCalendarOpen(false)} />}
    <section className="ai-brief-card booking-brief-card">
      <div className="ai-glow ai-glow-one" /><div className="ai-glow ai-glow-two" />
      <div className="booking-brief-header">
        <div className="booking-brief-label"><span><CalendarRange size={14} />Booking priority</span><i>Live</i></div>
        <div className="booking-brief-actions">
          <button type="button" onClick={openNew} title="New rental"><CarFront size={16} /><span>New rental</span></button>
          <button type="button" onClick={openNewBooking} title="New booking"><CalendarDays size={16} /><span>New booking</span></button>
        </div>
      </div>
      <div className="booking-brief-heading">
        <div><small>Nearest bookings in pickup order</small><h2>{nearestBookings.length ? "What is coming next" : "No upcoming bookings"}</h2></div>
        <span>{upcomingBookings.length ? `${upcomingBookings.length} scheduled` : "Fleet clear"}</span>
      </div>
      {nearestBookings.length ? <div className="booking-priority-list">
        {nearestBookings.map((booking, index) => <article className={`booking-priority-item ${index === 0 ? "is-next" : ""}`} key={booking.id}>
          <button type="button" className="booking-priority-open" onClick={() => openReservation(booking)}>
            <span className="booking-priority-order">{index === 0 ? "NEXT" : `#${index + 1}`}</span>
            <img src={booking.image} alt="" />
            <span className="booking-priority-body">
              <span className="booking-priority-car"><strong>{booking.vehicle}</strong><small>{booking.plate}</small></span>
              <span className="booking-priority-customer"><UserRound size={13} />{booking.customer}{booking.city ? <em> - {booking.city}</em> : null}</span>
              <span className="booking-priority-time"><b>{bookingMoment(booking)}</b><small>{booking.start} to {booking.returnDate}</small></span>
            </span>
          </button>
          <button type="button" className="booking-priority-whatsapp" title="Send WhatsApp reminder" aria-label={`Send WhatsApp reminder to ${booking.customer}`} onClick={() => sendBookingWhatsApp(booking, "reminder")}><MessageCircle size={17} /><span>Reminder</span></button>
        </article>)}
      </div> : <div className="booking-brief-empty"><span><CalendarRange size={22} /></span><div><strong>No customer is waiting for an upcoming pickup.</strong><small>Create a booking now and it will appear here automatically.</small></div></div>}
      <div className="booking-brief-footer">
        <button type="button" onClick={openPendingPayments}><IndianRupee size={15} /><span>Pending payments</span><strong>{money(settledPendingAmount)}</strong><ArrowRight size={15} /></button>
      </div>
    </section>
    <section className="side-card dashboard-reminders-inline">
          <div className="side-card-title"><div><h3>Reminders</h3><span>{reminders.length} active</span></div></div>
          {reminders.slice(0, 3).map((reminder) => <Reminder key={reminder.key} tone={reminder.tone} icon={reminderIcon(reminder.type)} type={reminder.type} title={reminder.title} text={reminder.text} action={reminder.reservationId ? () => { const booking = reservations.find((item) => item.id === reminder.reservationId); if (booking) openReservation(booking); } : reminder.rentalId ? () => { const rental = rentals.find((item) => item.id === reminder.rentalId); if (rental) openRental(rental); } : undefined} />)}
          <button className="full-link" onClick={openNotifications}>View all reminders <ChevronRight size={15} /></button>
        </section>
    <section className="stats-grid" aria-label="Fleet summary">{stats.map((stat) => { const Icon = stat.icon; return <article className={`stat-card ${stat.tone}`} key={stat.label}><div className="stat-top"><span className="stat-label-full">{stat.label}</span><span className="stat-label-mobile">{stat.shortLabel}</span><i><Icon size={15} /></i></div><strong>{stat.value}</strong><small>{stat.note}</small></article>; })}</section>
    <section className="attention-card"><div className="attention-icon"><AlertTriangle size={18} /></div><div><strong>{reminders.length} item{reminders.length === 1 ? "" : "s"} need your attention</strong><p>{reminders[0]?.title ?? "No urgent rental issues right now."}</p></div><button disabled={!reminders.length && !focus} onClick={() => { const first = reminders[0]; if (first?.reservationId) { const booking = reservations.find((item) => item.id === first.reservationId); if (booking) return openReservation(booking); } if (first?.rentalId) { const rental = rentals.find((item) => item.id === first.rentalId); if (rental) return openRental(rental); } if (focus) openRental(focus); }}>Review now <ArrowRight size={14} /></button></section>
    <div className="dashboard-layout">
      <FleetStatusPanel vehicles={vehicles} rentals={rentals} reservations={reservations} openRental={openRental} openVehicle={openVehicle} openReservation={openReservation} openBooking={openBooking} sendBookingWhatsApp={sendBookingWhatsApp} />
      <aside className="dashboard-side">
        
        <section className="side-card money-snapshot">
          <div className="side-card-title"><div><h3>Today’s money</h3><span>Live snapshot</span></div><span className="round-icon"><WalletCards size={16} /></span></div>
          <div className="money-line"><span>Collected</span><strong>{money(metrics.collectedToday)}</strong></div><div className="money-line"><span>Expenses</span><strong className="negative">− {money(metrics.expensesToday)}</strong></div><div className="net-line"><span>Net today</span><strong>{money(metrics.netToday)}</strong></div>
          <button className="full-link" onClick={() => goTo("accounts")}>Open accounts <ChevronRight size={15} /></button>
        </section>
      </aside>
    </div>
  </>;
}


function DashboardBookingCalendar({ bookings, rentals, close }: { bookings: BookingRecord[]; rentals: Rental[]; close: () => void }) {
  const [calendarMonth, setCalendarMonth] = useState(() => indiaDateKey(new Date()).slice(0, 7));
  const today = indiaDateKey(new Date());

  const monthStart = new Date(`${calendarMonth}-01T12:00:00+05:30`);
  const monthLabel = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(monthStart);

  const firstCell = new Date(monthStart);
  firstCell.setDate(1 - monthStart.getDay());

  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return { date, key: dateInputValue(date) };
  });

  const moveMonth = (delta: number) => {
    const next = new Date(`${calendarMonth}-01T12:00:00+05:30`);
    next.setMonth(next.getMonth() + delta);
    setCalendarMonth(dateInputValue(next).slice(0, 7));
  };

  const overlapsDate = (booking: BookingRecord, key: string) => {
    const dayStart = new Date(`${key}T00:00:00+05:30`).getTime();
    const dayEnd = new Date(`${key}T23:59:59+05:30`).getTime();
    return new Date(booking.startAt).getTime() <= dayEnd && new Date(booking.endAt).getTime() >= dayStart;
  };

  const statusClass = (booking: BookingRecord) => {
    if (booking.status === "rented") return "rented";
    if (booking.status === "completed") return "completed";
    if (booking.status === "cancelled") return "cancelled";
    return "booked";
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return <div className="dashboard-calendar-backdrop" onMouseDown={close}>
    <section className="dashboard-calendar-modal" role="dialog" aria-modal="true" aria-label="Booking calendar" onMouseDown={(event) => event.stopPropagation()}>
      <header className="dashboard-calendar-top">
        <div><small>BOOKING CALENDAR</small><strong>Quick month view</strong></div>
        <button type="button" className="dashboard-calendar-close" onClick={close} aria-label="Close booking calendar"><X size={18} /></button>
      </header>

      <div className="dashboard-calendar-month-nav">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button>
        <h2>{monthLabel}</h2>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">›</button>
      </div>

      <div className="dashboard-calendar-legend">
        <span><i className="booked" />Booking</span>
        <span><i className="rented" />Rented</span>
        <span><i className="completed" />Completed</span>
        <span><i className="cancelled" />Cancelled</span>
        <span><i className="change-required" />Change required</span>
      </div>

      <div className="dashboard-calendar-scroll">
        <div className="dashboard-calendar-weekdays">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="dashboard-calendar-grid">
          {calendarCells.map(({ date, key }) => {
            const dayBookings = bookings
              .filter((booking) => overlapsDate(booking, key))
              .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
            const outside = date.getMonth() !== monthStart.getMonth();

            return <div className={`dashboard-calendar-day ${outside ? "outside" : ""} ${key === today ? "today" : ""}`} key={key}>
              <strong className="dashboard-calendar-date">{date.getDate()}</strong>
              <div className="dashboard-calendar-events">
                {dayBookings.slice(0, 4).map((booking) => {
                  const changeRequired = bookingNeedsVehicleChangeOnDate(booking, key, bookings, rentals);
                  return <span className={`dashboard-calendar-entry ${statusClass(booking)} ${changeRequired ? "change-required" : ""}`} key={booking.id}>
                    <b>{booking.vehicle}</b>
                    <small>{booking.customer}</small>
                    {changeRequired ? <em>Change</em> : booking.status === "rented" ? <em>Rented</em> : null}
                  </span>;
                })}
                {dayBookings.length > 4 && <span className="dashboard-calendar-more">+{dayBookings.length - 4} more</span>}
              </div>
            </div>;
          })}
        </div>
      </div>
    </section>
  </div>;
}


function FleetStatusPanel({ vehicles, rentals, reservations, openRental, openVehicle, openReservation, openBooking, sendBookingWhatsApp }: { vehicles: Vehicle[]; rentals: Rental[]; reservations: Reservation[]; openRental: (rental: Rental) => void; openVehicle: (vehicle: Vehicle) => void; openReservation: (reservation: Reservation) => void; openBooking: (vehicleId: string, date: string) => void; sendBookingWhatsApp: (reservation: Reservation, purpose?: "confirmation" | "reminder") => void }) {
  const [availabilityDate, setAvailabilityDate] = useState(() => dateInputValue(new Date()));
  const dayStart = new Date(`${availabilityDate}T00:00:00+05:30`).getTime();
  const dayEnd = new Date(`${availabilityDate}T23:59:59+05:30`).getTime();
  const overlapsDay = (startAt: string, endAt: string) => new Date(startAt).getTime() <= dayEnd && new Date(endAt).getTime() >= dayStart;
  const prettyDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${availabilityDate}T12:00:00+05:30`));
  // MECARDEE_CLEAN_FLEET_STATUS_RETURNS_V8_9_36
  const fleetTimeLabel = (value: string) =>
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(new Date(value));

  const fleetDayLabel = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    }).formatToParts(new Date(value));
    const day = parts.find((part) => part.type === "day")?.value ?? "";
    const month = parts.find((part) => part.type === "month")?.value ?? "";
    return `${month} ${day}`.trim();
  };

  const fleetMomentLabel = (value: string) => {
    const date = new Date(value);
    const dayKey = indiaDateKey(date);
    const todayKey = indiaDateKey(new Date());
    const day = dayKey === todayKey ? "Today" : fleetDayLabel(value);
    return `${day} · ${fleetTimeLabel(value)}`;
  };

  const cards = vehicles.map((vehicle) => {
    const rental = rentals.find((item) => item.vehicleId === vehicle.id && item.state !== "completed" && overlapsDay(item.startAt, item.endAt));
    const reservation = reservations.find((item) => item.vehicleId === vehicle.id && overlapsDay(item.startAt, item.endAt));
    const blocked = ["maintenance", "inactive"].includes(vehicle.statusKey);
    const canBook = !rental && !reservation;
    let key = "available";
    let label = "Available";
    let detail = `Ready on ${prettyDate}`;
    if (rental) {
      key = "rented";
      label = "On rent";
      detail = `${rental.customer} · until ${rental.returnDate}`;
    } else if (reservation) {
      key = "booked";
      label = "Booked";
      detail = `${reservation.customer} · ${reservation.start} → ${reservation.returnDate}`;
    } else if (blocked) {
      key = vehicle.statusKey;
      label = vehicle.statusKey === "maintenance" ? "Maintenance" : "Inactive";
      detail = `${vehicle.note} · future booking allowed`;
    } else {
      const next = reservations
        .filter((item) => item.vehicleId === vehicle.id && new Date(item.startAt).getTime() > dayEnd)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];
      if (next) detail = `Next booking: ${next.start} · ${next.customer}`;
    }
    return { vehicle, rental, reservation, canBook, blocked, key, label, detail };
  });
  const availableCount = cards.filter((item) => item.key === "available").length;
  const bookedCount = cards.filter((item) => item.key === "booked").length;
  const rentedCount = cards.filter((item) => item.key === "rented").length;

  return <section className="fleet-status-section">
    <div className="fleet-status-heading">
      <div><h2>Car Status & Availability</h2><p>Choose a date and see the full fleet in one look.</p></div>
      <label className="availability-date"><CalendarDays size={16} /><span>Check date</span><input type="date" value={availabilityDate} min={dateInputValue(new Date())} onChange={(event) => setAvailabilityDate(event.target.value || dateInputValue(new Date()))} /></label>
    </div>
    <div className="availability-summary"><span className="available"><b>{availableCount}</b> Available</span><span className="booked"><b>{bookedCount}</b> Booked</span><span className="rented"><b>{rentedCount}</b> On rent</span></div>
    <div className="fleet-status-grid">
      {cards.map(({ vehicle, rental, reservation, canBook, blocked, key, label, detail }) => <article className={`fleet-status-card ${key}`} key={vehicle.id}>
        <div className="fleet-status-image"><img src={vehicle.image} alt={`${vehicle.name} vehicle`} onLoad={(event) => { const image = event.currentTarget; image.dataset.photoShape = image.naturalHeight > image.naturalWidth ? "portrait" : "landscape"; }} /><span className={`fleet-status-badge ${key}`}><i />{label}</span></div>
        <div className="fleet-status-body"><div><h3>{vehicle.name}</h3><strong>{vehicle.plate}</strong></div>
          <div className={`fleet-card-detail ${key}`}>
            {rental ? <>
              <span className="fleet-card-customer">{rental.customer}</span>
              <span className="fleet-return-highlight">
                <small>Returns on</small>
                <strong>{fleetDayLabel(rental.endAt)}</strong>
                <em>{fleetTimeLabel(rental.endAt)}</em>
              </span>
            </> : reservation ? <>
              <span className="fleet-card-customer">{reservation.customer}</span>
              <span className="fleet-booking-timing">
                <span><small>Pickup</small><strong>{fleetMomentLabel(reservation.startAt)}</strong></span>
                <span><small>Return</small><strong>{fleetMomentLabel(reservation.endAt)}</strong></span>
              </span>
            </> : <span className="fleet-available-box">{detail}</span>}
          </div>
          <div className="fleet-status-actions">
            {rental && <button className="primary-button" onClick={() => openRental(rental)}><CarFront size={15} />View rental</button>}
            {(canBook || Boolean(rental)) && <button className={`primary-button ${rental ? "rental-book-action" : ""}`} onClick={() => openBooking(vehicle.id, availabilityDate)}><CalendarDays size={15} />Book now</button>}
            {reservation && <><button className="primary-button booked-action" onClick={() => openReservation(reservation)}><CalendarRange size={15} />View booking</button><button className="booking-whatsapp-action" onClick={() => sendBookingWhatsApp(reservation, "reminder")} aria-label={`WhatsApp booking reminder to ${reservation.customer}`} title="WhatsApp booking reminder"><MessageCircle size={17} /></button></>}
            {canBook && blocked && <button className="fleet-secondary-action" onClick={() => openVehicle(vehicle)}>View vehicle</button>}
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}

function RentalCard({ rental, open, sendWhatsApp }: { rental: Rental; open: () => void; sendWhatsApp: () => void }) {
  return <article className={`rental-row ${rental.state}`}>
    <button className="rental-main" onClick={open}>
      <img src={rental.image} alt="" />
      <span className="rental-vehicle"><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span><strong>{rental.vehicle}</strong><small>{rental.plate} · {rental.id}</small></span>
      <span className="rental-customer"><small>Customer</small><strong>{rental.customer}</strong><span>{rental.phone}</span></span>
      <span className="rental-return"><small>Expected return</small><strong>{rental.returnDate}</strong><span>{rental.days} days · {money(rental.rate)}/day</span></span>
      <span className="rental-balance"><small>Balance due</small><strong>{money(rental.balance)}</strong><span>{money(rental.paid)} paid</span></span>
      <ChevronRight className="row-chevron" size={18} />
    </button>
    <div className="rental-quick"><a href={`tel:${rental.phone.replaceAll(" ", "")}`} aria-label={`Call ${rental.customer}`}><Phone size={15} /></a><button onClick={sendWhatsApp} aria-label={`WhatsApp ${rental.customer}`}><MessageCircle size={15} /></button><button onClick={open}><MoreHorizontal size={16} /></button></div>
  </article>;
}

function ReminderCopy({ type, text }: { type: string; text: string }) {
  if (type !== "booking") return <small>{text}</small>;
  const parts = text.split(/\s*\u00b7\s*/).filter(Boolean);
  const vehicle = parts[0] ?? "";
  const customer = parts[1] ?? "";
  const place = parts.slice(2).join(" \u00b7 ");
  return <small className="booking-reminder-copy">
    <span className="booking-reminder-vehicle">{vehicle}</span>
    {(customer || place) && <span className="booking-reminder-person">{customer}{customer && place ? " \u00b7 " : ""}{place}</span>}
  </small>;
}
function Reminder({ tone, icon: Icon, type, title, text, action }: { tone: string; icon: LucideIcon; type: string; title: string; text: string; action?: () => void }) {
  return <button className={`reminder ${tone}`} onClick={action}><span><Icon size={15} /></span><div><strong>{title}</strong><ReminderCopy type={type} text={text} /></div><ChevronRight size={15} /></button>;
}


function BookingsView({ bookings, rentals, vehicles, openBooking, editBooking, startBooking, sendWhatsApp, newBooking }: { bookings: BookingRecord[]; rentals: Rental[]; vehicles: Vehicle[]; openBooking: (booking: BookingRecord) => void; editBooking: (booking: BookingRecord) => void; startBooking: (booking: BookingRecord) => void; sendWhatsApp: (booking: BookingRecord) => void; newBooking: () => void }) {
  const [mode, setMode] = useState<"list" | "calendar">("list");
  const [statusFilter, setStatusFilter] = useState("All");
  const [vehicleFilter, setVehicleFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => indiaDateKey(new Date()).slice(0, 7));
  const today = indiaDateKey(new Date());

  const bucket = (booking: BookingRecord) => {
    if (booking.status === "rented") return "Active";
    if (booking.status === "completed") return "Completed";
    if (booking.status === "cancelled") return "Cancelled";
    if (booking.status === "booked" && indiaDateKey(booking.startAt) === today) return "Today";
    if (booking.status === "booked") return "Upcoming";
    return booking.status.replaceAll("_", " ");
  };

  const shown = bookings.filter((booking) => {
    const searchText = `${booking.bookingNumber} ${booking.vehicle} ${booking.plate} ${booking.customer} ${booking.phone}`.toLowerCase();
    if (query.trim() && !searchText.includes(query.trim().toLowerCase())) return false;
    if (vehicleFilter !== "All" && booking.vehicleId !== vehicleFilter) return false;
    if (statusFilter !== "All" && bucket(booking) !== statusFilter) return false;
    const startKey = indiaDateKey(booking.startAt);
    const endKey = indiaDateKey(booking.endAt);
    if (dateFrom && endKey < dateFrom) return false;
    if (dateTo && startKey > dateTo) return false;
    return true;
  }).sort((a, b) => {
    if (a.status === "booked" && b.status !== "booked") return -1;
    if (b.status === "booked" && a.status !== "booked") return 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const summary = {
    today: bookings.filter((booking) => booking.status === "booked" && indiaDateKey(booking.startAt) === today).length,
    upcoming: bookings.filter((booking) => booking.status === "booked" && indiaDateKey(booking.startAt) > today).length,
    active: bookings.filter((booking) => booking.status === "rented").length,
    completed: bookings.filter((booking) => booking.status === "completed").length,
    cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
  };

  const monthStart = new Date(`${calendarMonth}-01T12:00:00+05:30`);
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(monthStart);
  const firstCell = new Date(monthStart);
  firstCell.setDate(1 - monthStart.getDay());
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    const key = dateInputValue(date);
    return { date, key };
  });

  function moveMonth(delta: number) {
    const next = new Date(`${calendarMonth}-01T12:00:00+05:30`);
    next.setMonth(next.getMonth() + delta);
    setCalendarMonth(dateInputValue(next).slice(0, 7));
  }

  function overlapsDate(booking: BookingRecord, key: string) {
    const dayStart = new Date(`${key}T00:00:00+05:30`).getTime();
    const dayEnd = new Date(`${key}T23:59:59+05:30`).getTime();
    return new Date(booking.startAt).getTime() <= dayEnd && new Date(booking.endAt).getTime() >= dayStart;
  }

  return <>
    <PageHeading eyebrow="BOOKING CALENDAR" title="Bookings" description="See every reservation, active rental, completed booking and cancelled booking in one place." action={<button className="primary-button" onClick={newBooking}><Plus size={17} />New booking</button>} />
    <section className="booking-summary-strip">
      <button onClick={() => setStatusFilter("Today")}><span>Today</span><strong>{summary.today}</strong></button>
      <button onClick={() => setStatusFilter("Upcoming")}><span>Upcoming</span><strong>{summary.upcoming}</strong></button>
      <button onClick={() => setStatusFilter("Active")}><span>Active</span><strong>{summary.active}</strong></button>
      <button onClick={() => setStatusFilter("Completed")}><span>Completed</span><strong>{summary.completed}</strong></button>
      <button onClick={() => setStatusFilter("Cancelled")}><span>Cancelled</span><strong>{summary.cancelled}</strong></button>
    </section>
    <section className="bookings-toolbar">
      <div className="booking-view-switch"><button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}><CalendarRange size={15} />List view</button><button className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")}><CalendarDays size={15} />Calendar view</button></div>
      <label className="booking-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, phone, vehicle or booking" /></label>
      <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)}><option value="All">All vehicles</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Upcoming</option><option>Today</option><option>Active</option><option>Completed</option><option>Cancelled</option></select>
      <label className="mecardee-report-filter-field"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
      <label className="mecardee-report-filter-field"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
    </section>

    {mode === "list" ? <section className="booking-list-panel">
      <div className="booking-list-head"><span>Vehicle / booking</span><span>Customer</span><span>Pickup</span><span>Return</span><span>Amount</span><span>Status</span><span>Actions</span></div>
      {shown.length ? shown.map((booking) => {
        const vehicle = vehicles.find((item) => item.id === booking.vehicleId);
        const canStart = booking.status === "booked" && vehicle?.statusKey === "available" && Date.now() >= new Date(booking.startAt).getTime();
        const status = bucket(booking);
        return <article className="booking-list-row" key={booking.id}>
          <span className="booking-car"><img src={booking.image} alt="" /><span><strong>{booking.vehicle}</strong><small>{booking.plate} · {booking.bookingNumber}</small></span></span>
          <span><strong>{booking.customer}</strong><small>{booking.phone}</small></span>
          <span><strong>{booking.start}</strong><small>{booking.days} day{booking.days === 1 ? "" : "s"}</small></span>
          <span><strong>{booking.returnDate}</strong><small>Advance {money(booking.advancePaid)}</small></span>
          <span><strong>{money(booking.amount)}</strong><small>{booking.balance > 0 ? `${money(booking.balance)} pending` : "No pending balance"}</small></span>
          <span><b className={`booking-status-pill ${status.toLowerCase()}`}>{status}</b></span>
          <span className="booking-row-actions">
            <button onClick={() => openBooking(booking)}>View</button>
            {booking.status === "booked" && <button onClick={() => editBooking(booking)}><Pencil size={14} />Edit</button>}
            <button className="whatsapp" onClick={() => sendWhatsApp(booking)} aria-label={`WhatsApp ${booking.customer}`}><MessageCircle size={15} /></button>
            {booking.status === "booked" && <button className="start" disabled={!canStart} onClick={() => startBooking(booking)} title={canStart ? "Start rental" : vehicle?.statusKey !== "available" ? "Vehicle must be Available" : "Pickup time has not arrived"}><CarFront size={14} />Start rental</button>}
          </span>
        </article>;
      }) : <div className="booking-empty"><CalendarDays size={25} /><strong>No bookings match these filters.</strong><span>Change the filters or create a new booking.</span></div>}
    </section> : <section className="booking-calendar-panel">
      <div className="booking-calendar-heading"><button onClick={() => moveMonth(-1)} aria-label="Previous month">‹</button><h2>{monthLabel}</h2><div className="booking-calendar-legend" aria-label="Calendar colour legend"><span className="booking-legend-booked"><i />Booking</span><span className="booking-legend-rented"><i />Rented</span><span className="booking-legend-change"><i />Change required</span></div><button onClick={() => moveMonth(1)} aria-label="Next month">›</button></div>
      <div className="booking-calendar-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="booking-calendar-grid">
        {calendarCells.map(({ date, key }) => {
          const dayBookings = shown.filter((booking) => overlapsDate(booking, key));
          const outside = date.getMonth() !== monthStart.getMonth();
          return <div className={`booking-calendar-day ${outside ? "outside" : ""} ${key === today ? "today" : ""}`} key={key}>
            <strong>{date.getDate()}</strong>
            <div>{dayBookings.slice(0, 3).map((booking) => { const changeRequired = bookingNeedsVehicleChangeOnDate(booking, key, bookings, rentals); return <button key={booking.id} className={`${bucket(booking).toLowerCase()} ${booking.status === "rented" ? "calendar-rented" : "calendar-booking"} ${changeRequired ? "calendar-change-required" : ""}`} onClick={() => openBooking(booking)} title={`${changeRequired ? "Change required" : booking.status === "rented" ? "Rented" : "Booking"} · ${booking.vehicle} · ${booking.customer}`}><span>{booking.vehicle}</span><small>{booking.customer}</small>{changeRequired ? <b className="calendar-change-required-tag">Change</b> : booking.status === "rented" ? <b className="calendar-rented-tag">Rented</b> : null}</button>; })}{dayBookings.length > 3 && <span className="booking-more">+{dayBookings.length - 3} more</span>}</div>
          </div>;
        })}
      </div>
    </section>}
  </>;
}

function RentalsView({ rentals, metrics, openRental, openNew }: { rentals: Rental[]; metrics: Metrics; openRental: (rental: Rental) => void; openNew: () => void }) {
  const [filter, setFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [extraFilter, setExtraFilter] = useState("");
  const shown = rentals.filter((rental) => {
    const matchesState = filter === "All" || (filter === "Active" ? rental.state !== "completed" : rental.state === filter.toLowerCase());
    const start = rental.startAt.slice(0, 10); const end = rental.endAt.slice(0, 10);
    const matchesDate = (!dateFrom || end >= dateFrom) && (!dateTo || start <= dateTo);
    const q = extraFilter.trim().toLowerCase();
    const matchesExtra = !q || `${rental.id} ${rental.vehicle} ${rental.plate} ${rental.customer} ${rental.phone}`.toLowerCase().includes(q);
    return matchesState && matchesDate && matchesExtra;
  });
  return <>
    <PageHeading eyebrow="RENTAL OPERATIONS" title="Rentals" description="Track every booking from handover to final payment." action={<button className="primary-button" onClick={openNew}><Plus size={17} />New rental</button>} />
    <section className="mini-stats"><article><CalendarDays size={19} /><div><span>Active rentals</span><strong>{metrics.activeRentals}</strong></div></article><article><Clock3 size={19} /><div><span>Returning today</span><strong>{metrics.returningToday}</strong></div></article><article><AlertTriangle size={19} /><div><span>Overdue</span><strong>{metrics.overdue}</strong></div></article><article><CircleDollarSign size={19} /><div><span>Outstanding</span><strong>{money(metrics.outstanding)}</strong></div></article></section>
    <section className="data-panel">
      <div className="panel-toolbar"><div className="filter-tabs">{["All", "Active", "Overdue", "Completed"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>)}</div><div className="toolbar-actions"><button onClick={() => { const from = window.prompt("From date (YYYY-MM-DD). Leave blank for any date.", dateFrom) ?? dateFrom; const to = window.prompt("To date (YYYY-MM-DD). Leave blank for any date.", dateTo) ?? dateTo; setDateFrom(from.trim()); setDateTo(to.trim()); }}><CalendarRange size={15} />Date range</button><button onClick={() => setExtraFilter(window.prompt("Filter by rental ID, vehicle, plate, customer or phone", extraFilter) ?? extraFilter)}><SlidersHorizontal size={15} />Filters</button></div></div>
      <div className="history-table"><div className="table-head"><span>Rental</span><span>Customer</span><span>Rental period</span><span>Amount</span><span>Balance</span><span>Status</span><span /></div>{shown.map((rental) => <button className="history-row" key={rental.id} onClick={() => openRental(rental)}><span className="vehicle-cell"><img src={rental.image} alt="" /><span><strong>{rental.vehicle}</strong><small>{rental.plate} · {rental.id}</small></span></span><span><strong>{rental.customer}</strong><small>{rental.phone}</small></span><span><strong>{rental.start.split(",")[0]} → {rental.returnDate.split(",")[0]}</strong><small>{rental.days} rental days</small></span><span><strong>{money(rental.total)}</strong><small>{money(rental.rate)}/day</small></span><span><strong className={rental.balance ? "red-text" : "green-text"}>{money(rental.balance)}</strong><small>{money(rental.paid)} paid</small></span><span><i className={`status-pill ${rental.state}`}><b />{rental.statusText}</i></span><ChevronRight size={16} /></button>)}</div>
    </section>
  </>;
}

function VehiclesView({ vehicles, metrics, openNew, addVehicle, openVehicle, showToast }: { vehicles: Vehicle[]; metrics: Metrics; openNew: (vehicleId?: string) => void; addVehicle: () => void; openVehicle: (vehicle: Vehicle) => void; showToast: (message: string) => void }) {
  const [filter, setFilter] = useState("All vehicles");
  const [textFilter, setTextFilter] = useState("");
  const shown = vehicles.filter((vehicle) => {
    const matchesStatus = filter === "All vehicles" || (filter === "Rented" ? ["rented", "today", "overdue"].includes(vehicle.statusKey) : vehicle.statusKey === filter.toLowerCase());
    const q = textFilter.trim().toLowerCase();
    return matchesStatus && (!q || `${vehicle.name} ${vehicle.make} ${vehicle.plate} ${vehicle.fuel} ${vehicle.transmission}`.toLowerCase().includes(q));
  });
  return <>
    <PageHeading eyebrow="FLEET" title="Vehicles" description="Your full fleet, availability and document health in one place." action={<div className="heading-actions"><button className="secondary-button mobile-vehicle-add" onClick={addVehicle} aria-label="Add vehicle"><Plus size={16} /><span>Add vehicle</span></button><button className="primary-button" onClick={() => openNew()}><CalendarDays size={16} />Rent a car</button></div>} />
    <section className="fleet-strip"><div><span className="strip-icon"><CarFront size={19} /></span><p><strong>{metrics.totalCars} vehicles</strong><small>Total fleet</small></p></div><div><i className="dot available" /><p><strong>{metrics.availableCars} available</strong><small>{metrics.totalCars ? Math.round((metrics.availableCars / metrics.totalCars) * 100) : 0}% of fleet</small></p></div><div><i className="dot rented" /><p><strong>{metrics.onRentCars} on rent</strong><small>{metrics.overdue ? `${metrics.overdue} overdue` : "No overdue rentals"}</small></p></div><div><i className="dot maintenance" /><p><strong>{metrics.maintenanceCars} in service</strong><small>Maintenance status</small></p></div><span className="fleet-progress"><i style={{ width: `${metrics.roadReadyPercent}%` }} /></span></section>
    <div className="panel-toolbar vehicle-toolbar"><div className="filter-tabs">{["All vehicles", "Available", "Rented", "Maintenance", "Inactive"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button" onClick={() => setTextFilter(window.prompt("Filter by vehicle, make, plate, fuel or transmission", textFilter) ?? textFilter)}><SlidersHorizontal size={15} />More filters</button></div>
    <section className="vehicle-grid">{shown.map((vehicle) => <article className="vehicle-card" key={vehicle.id}><div className="vehicle-photo"><img src={vehicle.image} alt={`${vehicle.name} vehicle`} onLoad={(event) => { const image = event.currentTarget; image.dataset.photoShape = image.naturalHeight > image.naturalWidth ? "portrait" : "landscape"; }} /><span className={`vehicle-status ${vehicle.statusKey}`}><i />{vehicle.status}</span><button aria-label={`More options for ${vehicle.name}`} onClick={() => showToast(`${vehicle.name} · ${vehicle.plate} · ${vehicle.odometer}`)}><MoreHorizontal size={17} /></button></div><div className="vehicle-card-body"><div className="vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.plate}</p></div><strong>{money(vehicle.rate)}<small>/ day</small></strong></div><div className="spec-row"><span><Fuel size={14} />{vehicle.fuel}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.year}</span></div><div className="odometer"><span><Gauge size={15} />Odometer</span><strong>{vehicle.odometer}</strong></div><div className={`document-note ${vehicle.statusKey === "overdue" || vehicle.statusKey === "today" ? "warning" : ""}`}><ShieldCheck size={14} /><span><strong>{vehicle.note}</strong><small>{vehicle.docs}</small></span></div><div className="vehicle-actions"><button onClick={() => openVehicle(vehicle)}>View vehicle</button><button onClick={() => openNew(vehicle.id)} disabled={vehicle.statusKey !== "available"}>{vehicle.statusKey === "available" ? "Rent now" : "Unavailable"}</button></div></div></article>)}</section>
  </>;
}

function GuestCarsView({ vehicles, rentals, addVehicle, openVehicle, openRental }: { vehicles: Vehicle[]; rentals: Rental[]; addVehicle: () => void; openVehicle: (vehicle: Vehicle, edit?: boolean) => void; openRental: (rental: Rental) => void }) {
  const [textFilter, setTextFilter] = useState("");
  const shown = vehicles.filter((vehicle) => {
    const q = textFilter.trim().toLowerCase();
    return !q || `${vehicle.name} ${vehicle.make} ${vehicle.plate} ${vehicle.fuel} ${vehicle.transmission} ${vehicle.guestOwnerName} ${vehicle.guestOwnerPlace}`.toLowerCase().includes(q);
  });
  const available = vehicles.filter((vehicle) => vehicle.statusKey === "available").length;
  const onRent = vehicles.filter((vehicle) => ["rented", "today", "overdue"].includes(vehicle.statusKey)).length;
  const usageRows = rentals.flatMap((rental) => rental.segments
    .filter((segment) => segment.isGuest)
    .map((segment) => ({ rental, segment, charge: Number(segment.rentalCharge || 0) + Number(segment.extraKmCharge || 0) })))
    .sort((a, b) => new Date(b.segment.startAt).getTime() - new Date(a.segment.startAt).getTime());
  const totalCustomerCharges = usageRows.reduce((sum, row) => sum + row.charge, 0);

  return <>
    <PageHeading eyebrow="TEMPORARY FLEET" title="Guest Cars" description="External vehicles available only for temporary or replacement rental use." action={<button className="primary-button" onClick={addVehicle}><Plus size={16} />Add Guest Car</button>} />
    <section className="guest-car-summary">
      <div><CarFront size={18} /><span><strong>{vehicles.length}</strong><small>Guest Cars</small></span></div>
      <div><CheckCircle2 size={18} /><span><strong>{available}</strong><small>Available</small></span></div>
      <div><CalendarRange size={18} /><span><strong>{onRent}</strong><small>In use</small></span></div>
      <p>Guest Car rental amounts stay outside main business revenue and vehicle-income reports.</p>
    </section>
    <div className="panel-toolbar vehicle-toolbar"><div><strong>Guest Car list</strong></div><button className="filter-button" onClick={() => setTextFilter(window.prompt("Filter Guest Cars by name, make, plate, fuel or transmission", textFilter) ?? textFilter)}><SlidersHorizontal size={15} />Filter</button></div>
    {shown.length ? <section className="vehicle-grid">{shown.map((vehicle) => <article className="vehicle-card guest-vehicle-card" key={vehicle.id}>
      <div className="vehicle-photo"><img src={vehicle.image} alt={`${vehicle.name} Guest Car`} onLoad={(event) => { const image = event.currentTarget; image.dataset.photoShape = image.naturalHeight > image.naturalWidth ? "portrait" : "landscape"; }} /><span className={`vehicle-status ${vehicle.statusKey}`}><i />{vehicle.status}</span><span className="guest-car-badge">Guest Car</span></div>
      <div className="vehicle-card-body"><div className="vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.plate}</p></div><strong>{money(vehicle.rate)}<small>/ day</small></strong></div><div className="guest-owner-meta"><UserRound size={13} /><span><strong>{vehicle.guestOwnerName || "Owner not recorded"}</strong><small>{vehicle.guestOwnerPlace || "Place not recorded"}</small></span></div>
        <div className="spec-row"><span><Fuel size={14} />{vehicle.fuel}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.year}</span></div>
        <div className="odometer"><span><Gauge size={15} />Odometer</span><strong>{vehicle.odometer}</strong></div>
        <div className="document-note"><ShieldCheck size={14} /><span><strong>{vehicle.note}</strong><small>Basic Guest Car details only · no maintenance tracking</small></span></div>
        <div className="vehicle-actions"><button onClick={() => openVehicle(vehicle, false)}>View Guest Car</button><button onClick={() => openVehicle(vehicle, true)}>Edit Guest Car</button></div>
      </div>
    </article>)}</section> : <section className="empty-state-card"><CarFront size={28} /><h3>No Guest Cars yet</h3><p>Add an external vehicle when you need a temporary replacement.</p><button className="primary-button" onClick={addVehicle}><Plus size={16} />Add Guest Car</button></section>}

    <section className="data-panel guest-car-report-panel">
      <div className="panel-heading"><div><h2>Guest Car usage report</h2><p>Guest Car history is shown only here and remains excluded from main Reports, Payments and Accounts.</p></div><span className="guest-report-total"><small>Customer charges</small><strong>{money(totalCustomerCharges)}</strong></span></div>
      {usageRows.length ? <div className="guest-usage-list">
        <div className="guest-usage-head"><span>Guest Car</span><span>Customer / rental</span><span>Usage period</span><span>KM</span><span>Charge</span><span /></div>
        {usageRows.map(({ rental, segment, charge }) => <article className="guest-usage-row" key={segment.id}>
          <span><strong>{segment.vehicle}</strong><small>{segment.plate} · Segment #{segment.sequence}</small></span>
          <span><strong>{rental.customer}</strong><small>{rental.id}</small></span>
          <span><strong>{segment.start}</strong><small>{segment.endAt ? `to ${segment.end}` : "Current active segment"}</small></span>
          <span><strong>{segment.startingKilometer.toLocaleString("en-IN")} km</strong><small>{segment.endingKilometer == null ? "Ending KM pending" : `to ${segment.endingKilometer.toLocaleString("en-IN")} km`}</small></span>
          <span><strong>{segment.endAt ? money(charge) : "In use"}</strong><small>{segment.endAt ? `${segment.rentalDays} day${segment.rentalDays === 1 ? "" : "s"}` : "Final charge calculated when segment closes"}</small></span>
          <button type="button" onClick={() => openRental(rental)}>View rental <ChevronRight size={14} /></button>
        </article>)}
      </div> : <div className="booking-empty guest-report-empty"><History size={24} /><strong>No Guest Car usage yet.</strong><span>Usage will appear here when a Guest Car is assigned to a rental.</span></div>}
    </section>
  </>;
}

function customerPhoneKey(value: string) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

function customerCreateError(message: string | undefined) {
  const detail = String(message ?? "");
  if (/duplicate|unique|customers_phone_unique|already exists/i.test(detail)) return "This phone number is already added to another customer. Please use the existing customer.";
  return detail || "Could not save customer.";
}
function CustomersView({ customers, metrics, openNew, openRentalById, addCustomer, editCustomer, deleteCustomer , rentals, payments, currentUser}: { customers: CustomerRow[]; metrics: Metrics; openNew: () => void; openRentalById: (rentalId: string) => void; addCustomer: () => void; editCustomer: (customer: CustomerRow) => void; deleteCustomer: (customer: CustomerRow) => void ; rentals: Rental[]; payments: PaymentRow[]; currentUser: AuthUser}) {
  const [historyCustomer, setHistoryCustomer] = useState<CustomerRow | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const shown = customers.filter((customer) => {
    const q = search.trim().toLowerCase(); const city = cityFilter.trim().toLowerCase();
    return (!q || `${customer.name} ${customer.phone}`.toLowerCase().includes(q)) && (!city || customer.city.toLowerCase().includes(city));
  });
  return <>
  {<>
    <PageHeading eyebrow="CUSTOMER DIRECTORY" title="Customers" description="Rental history, documents and balances—without duplicate records." action={<button className="primary-button" onClick={addCustomer}><UserRoundPlus size={17} />Add customer</button>} />
    <section className="customer-summary"><article><UsersRound size={20} /><div><strong>{metrics.totalCustomers}</strong><span>Total customers</span></div><small><TrendingUp size={13} /> {metrics.newCustomersThisMonth} this month</small></article><article><CalendarDays size={20} /><div><strong>{metrics.currentlyRentingCustomers}</strong><span>Currently renting</span></div><small>{metrics.totalCustomers ? Math.round((metrics.currentlyRentingCustomers / metrics.totalCustomers) * 100) : 0}% of customers</small></article><article><IndianRupee size={20} /><div><strong>{money(metrics.outstanding)}</strong><span>Pending balance</span></div><small className="warn"><AlertTriangle size={13} /> {metrics.outstandingCustomers} customers</small></article></section>
    <section className="data-panel customer-panel"><div className="panel-toolbar"><label className="panel-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" placeholder="Search name or mobile number" /></label><button className="filter-button" onClick={() => setCityFilter(window.prompt("Filter by city. Leave blank for all.", cityFilter) ?? cityFilter)}><SlidersHorizontal size={15} />Filters</button></div><div className="customer-list"><div className="customer-list-head"><span>Customer</span><span>Driving licence</span><span>Rental activity</span><span>Amount spent</span><span>Balance</span><span /></div>{shown.map((customer) => <article className="customer-list-row" key={customer.id}><span className="customer-identity"><i>{customer.initials}</i><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.city}</small></span></span><span><strong>{customer.licence || "Not recorded"}</strong><small>{customer.licence ? "Recorded" : "Optional"}</small></span><span><strong>{customer.rentals} rentals</strong><small>{customer.active ? `Active: ${customer.active}` : "No active rental"}</small></span><span><strong>{money(customer.spent)}</strong><small>Lifetime value</small></span><span><strong className={customer.pending ? "red-text" : "green-text"}>{money(customer.pending)}</strong><small>{customer.pending ? "Pending" : "Fully paid"}</small></span><span className="customer-actions"><button className="customer-icon-action" aria-label={`Call ${customer.name}`} onClick={() => { window.location.href = `tel:${customer.phone.replaceAll(" ", "")}`; }}><Phone size={15} /></button><button className="customer-icon-action" aria-label={`Edit ${customer.name}`} onClick={() => editCustomer(customer)}><Pencil size={15} /></button><button className="customer-history-action" type="button" onClick={() => setHistoryCustomer(customer)}>View history</button>{currentUser.role === "superadmin" && <button className="customer-icon-action customer-delete-action" aria-label={`Delete ${customer.name}`} title="Delete customer" onClick={() => deleteCustomer(customer)}><Trash2 size={15} /></button>}<button className="customer-primary-action" onClick={() => customer.activeRentalId ? openRentalById(customer.activeRentalId) : openNew()}>{customer.active ? "View rental" : "Rent again"}</button><ChevronRight size={16} /></span></article>)}</div></section>
  </>}
  {historyCustomer && <CustomerHistoryDialog customer={historyCustomer} rentals={rentals} payments={payments} close={() => setHistoryCustomer(null)} openRentalById={openRentalById} />}
</>;
}

function CustomerHistoryDialog({ customer, rentals, payments, close, openRentalById }: { customer: CustomerRow; rentals: Rental[]; payments: PaymentRow[]; close: () => void; openRentalById: (id: string) => void }) {
  const phoneKey = customerPhoneKey(customer.phone);
  const nameKey = String(customer.name || "").trim().toLowerCase();

  const customerRentals = rentals
    .filter((rental) => {
      if (rental.customerId === customer.id) return true;
      if (phoneKey && customerPhoneKey(rental.phone) === phoneKey) return true;
      return !phoneKey && String(rental.customer || "").trim().toLowerCase() === nameKey;
    })
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  const rentalIds = new Set(customerRentals.map((rental) => rental.id));

  const customerPayments = payments
    .filter((payment) => {
      if (payment.rental && rentalIds.has(String(payment.rental))) return true;
      if (phoneKey && customerPhoneKey(String(payment.phone || "")) === phoneKey) return true;
      return !phoneKey && String(payment.customer || "").trim().toLowerCase() === nameKey;
    })
    .sort((a, b) => new Date(String(b.receivedAt || "")).getTime() - new Date(String(a.receivedAt || "")).getTime());

  const totalRentalValue = customerRentals.reduce((sum, rental) => sum + Number(rental.total || 0), 0);
  const totalCollected = customerPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const outstanding = customerRentals.reduce((sum, rental) => sum + Number(rental.balance || 0), 0);

  const historyWhen = (value: string | undefined) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(parsed);
  };

  return <DialogShell title={`${customer.name} history`} subtitle={`${customer.phone || "No phone"} - ${customer.city || "No city"}`} close={close} wide>
    <div className="customer-history-dialog">
      <div className="customer-history-summary">
        <article><small>Rentals</small><strong>{customerRentals.length}</strong></article>
        <article><small>Rental value</small><strong>{money(totalRentalValue)}</strong></article>
        <article><small>Collected</small><strong>{money(totalCollected)}</strong></article>
        <article className={outstanding > 0 ? "due" : ""}><small>Outstanding</small><strong>{money(outstanding)}</strong></article>
      </div>

      <section className="customer-history-section">
        <div className="customer-history-section-head">
          <div><span className="eyebrow">VEHICLE ACTIVITY</span><h3>Rental history</h3></div>
          <span className="customer-history-count">{customerRentals.length}</span>
        </div>

        <div className="customer-history-list">
          {customerRentals.length ? customerRentals.map((rental) => <article className="customer-history-rental" key={rental.id}>
            <div className="customer-history-rental-main">
              <div className="customer-history-date"><small>Start</small><strong>{historyWhen(rental.startAt)}</strong></div>
              <div className="customer-history-vehicle"><strong>{rental.vehicle}</strong><small>{rental.plate} - {rental.id}</small></div>
              <span className={`customer-history-status ${rental.state}`}>{rental.statusText || rental.state}</span>
            </div>

            <div className="customer-history-rental-meta">
              <span><small>Return</small><strong>{historyWhen(rental.endAt)}</strong></span>
              <span><small>Rental</small><strong>{money(Number(rental.total || 0))}</strong></span>
              <span><small>Paid</small><strong>{money(Number(rental.paid || 0))}</strong></span>
              <span><small>Balance</small><strong>{money(Number(rental.balance || 0))}</strong></span>
            </div>

            <button className="customer-history-open-rental" type="button" onClick={() => { close(); openRentalById(rental.id); }}>View rental</button>
          </article>) : <div className="customer-history-empty">No rental history for this customer yet.</div>}
        </div>
      </section>

      <section className="customer-history-section">
        <div className="customer-history-section-head">
          <div><span className="eyebrow">MONEY RECEIVED</span><h3>Payment history</h3></div>
          <span className="customer-history-count">{customerPayments.length}</span>
        </div>

        <div className="customer-history-list">
          {customerPayments.length ? customerPayments.map((payment, index) => <article className="customer-history-payment" key={payment.id || `${payment.rental || "payment"}-${payment.receivedAt || index}`}>
            <div>
              <strong>{money(Number(payment.amount || 0))}</strong>
              <small>{historyWhen(payment.receivedAt || payment.date)}</small>
            </div>
            <div>
              <span>{payment.method || "Payment method not recorded"}</span>
              <small>{payment.rental || "No rental reference"} - {String(payment.type || "payment").replaceAll("_", " ")}</small>
            </div>
          </article>) : <div className="customer-history-empty">No payment history for this customer yet.</div>}
        </div>
      </section>
    </div>
  </DialogShell>;
}


function PaymentsView({ rentals, payments, metrics, openPayment, openExpense, exportPayments, sendWhatsApp }: { rentals: Rental[]; payments: PaymentRow[]; metrics: Metrics; openPayment: () => void; openExpense: () => void; exportPayments: () => void; sendWhatsApp: (rental: Rental, purpose?: string) => void }) {
  // Payments is a business accounting view, so Guest Car rental value is excluded here.
  // Customer-facing reminders still use the rental's real full balance.
  const outstanding = [...rentals].filter((rental) => rental.businessBalance > 0).sort((a, b) => b.businessBalance - a.businessBalance);
  return <>
    <PageHeading eyebrow="MONEY" title="Expenses & Payments" description="Record business expenses, customer collections and outstanding balances from one place." action={<div className="payments-page-actions"><button className="secondary-button expense-action-button" onClick={openExpense}><ReceiptIndianRupee size={17} />Add expense</button><button className="primary-button" onClick={openPayment}><Plus size={17} />Receive payment</button></div>} />
    <section className="payment-summary"><article className="featured"><span>Collected this month</span><strong>{money(metrics.collectedMonth)}</strong><small><TrendingUp size={14} /> {metrics.collectionChangePercent >= 0 ? "+" : ""}{metrics.collectionChangePercent}% vs last month</small></article><article><span>Collected today</span><strong>{money(metrics.collectedToday)}</strong><small>{metrics.paymentsToday} payments</small></article><article><span>Outstanding</span><strong>{money(metrics.outstanding)}</strong><small className="red-text">Across {metrics.outstandingRentals} rentals</small></article><article><span>Expenses this month</span><strong>{money(metrics.expensesMonth)}</strong><small>Business expenses recorded</small></article></section>
    <div className="payments-layout"><section className="data-panel"><div className="panel-heading"><div><h2>Recent payments</h2><p>Latest customer collections</p></div><button onClick={exportPayments}><Download size={15} />Export</button></div><div className="payments-table"><div className="payments-head"><span>Customer</span><span>Rental</span><span>Date</span><span>Method</span><span>Amount</span></div>{payments.map((payment) => <article key={payment.id}><span><i>{payment.customer.split(" ").map((part) => part[0]).join("")}</i><span><strong>{payment.customer}</strong><small>{payment.id}</small></span></span><span><strong>{payment.rental}</strong><small>Received by {payment.receivedBy}</small></span><span>{payment.date}</span><span><b>{payment.method}</b></span><strong className="green-text">+ {money(payment.amount)}</strong></article>)}</div></section><aside className="outstanding-card"><div className="panel-heading"><div><h2>Outstanding</h2><p>Follow up with {metrics.outstandingCustomers} customers</p></div></div>{outstanding.slice(0,3).map((rental) => <article key={rental.id}><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.vehicle} · {rental.statusText}</small></div><b>{money(rental.businessBalance)}</b><button onClick={() => sendWhatsApp(rental, "payment reminder")} aria-label={`Send reminder to ${rental.customer}`}><Send size={14} /></button></article>)}<button className="full-link" onClick={() => window.alert(outstanding.length ? outstanding.map((rental) => `${rental.customer} · ${rental.id} · ${money(rental.businessBalance)}`).join("\n") : "No outstanding balances.")}>View outstanding report <ChevronRight size={15} /></button></aside></div>
  </>;
}

function safeReportText(value: string | number) {
  return String(value).replace(/₹/g, "INR ").replace(/[–—→·]/g, "-").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
}

function reportCurrency(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value)}`;
}

function downloadExcelTable(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  currencyColumns: number[],
  totalLabel: string,
  total: number,
) {
  const xmlEscape = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const widths = headers.map((header, columnIndex) => {
    const longest = Math.max(header.length, ...rows.slice(0, 100).map((row) => String(row[columnIndex] ?? "").length));
    return Math.min(210, Math.max(85, longest * 7.2));
  });
  const cells = (row: (string | number)[]) => row.map((cell, columnIndex) => {
    const numeric = typeof cell === "number";
    const style = numeric && currencyColumns.includes(columnIndex) ? "Currency" : numeric ? "Number" : "Cell";
    return `<Cell ss:StyleID="${style}"><Data ss:Type="${numeric ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`;
  }).join("");
  const mergeAcross = Math.max(0, headers.length - 1);
  const totalMerge = Math.max(0, headers.length - 2);
  const xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Styles>\n<Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n<Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#071A17"/><Alignment ss:Vertical="Center"/></Style>\n<Style ss:ID="Subtitle"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#666B79"/></Style>\n<Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#071A17" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>\n<Style ss:ID="Cell"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="Number"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="Currency"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="₹#,##0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="TotalLabel"><Font ss:Bold="1"/><Interior ss:Color="#EAF0EC" ss:Pattern="Solid"/></Style>\n<Style ss:ID="TotalValue"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="₹#,##0.00"/><Interior ss:Color="#EAF0EC" ss:Pattern="Solid"/></Style>\n</Styles>\n<Worksheet ss:Name="Report"><Table>\n${widths.map((width) => `<Column ss:Width="${width.toFixed(0)}"/>`).join("\n")}\n<Row ss:Height="30"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Title"><Data ss:Type="String">${xmlEscape(title)}</Data></Cell></Row>\n<Row ss:Height="22"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Subtitle"><Data ss:Type="String">${xmlEscape(subtitle)}</Data></Cell></Row>\n<Row ss:Height="8"></Row>\n<Row ss:Height="24">${headers.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>\n${rows.map((row) => `<Row ss:Height="21">${cells(row)}</Row>`).join("\n")}\n<Row ss:Height="24"><Cell ss:MergeAcross="${totalMerge}" ss:StyleID="TotalLabel"><Data ss:Type="String">${xmlEscape(totalLabel)}</Data></Cell><Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${total}</Data></Cell></Row>\n</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane></WorksheetOptions></Worksheet>\n</Workbook>`;
  const url = URL.createObjectURL(new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadPdfTable(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  currencyColumns: number[],
  totalLabel: string,
  total: number,
) {
  const DEEP = "#071a17";
  const INK = "#10201d";
  const MUTED = "#64736f";
  const LINE = "#d9e2de";
  const PAPER = "#f7f9f8";
  const SOFT = "#eaf0ec";

  const headerIndex = Object.fromEntries(headers.map((header, index) => [header.toLowerCase(), index]));
  const sumColumn = (label: string) => {
    const index = headerIndex[label.toLowerCase()];
    if (index === undefined) return 0;
    return rows.reduce((sum, row) => sum + (typeof row[index] === "number" ? Number(row[index]) : 0), 0);
  };
  const uniqueCount = (label: string) => {
    const index = headerIndex[label.toLowerCase()];
    if (index === undefined) return 0;
    return new Set(rows.map((row) => String(row[index] ?? "").trim()).filter(Boolean)).size;
  };

  const key = headers.join("|").toLowerCase();
  const reportWidths: (number | string)[] = key.includes("rental|vehicle|customer|start|return|status|total|paid|balance")
    ? [74, 112, 84, 70, 70, "*", 68, 68, 68]
    : key.includes("payment|customer|rental|date|method|amount|received by")
      ? [88, 105, 92, 76, 64, 74, "*"]
      : key.includes("date|category|vehicle|method|amount|description")
        ? [70, 92, 115, 72, 76, "*"]
        : key.includes("rental|customer|phone|vehicle|expected return|status|balance")
          ? [90, 100, 88, 116, 88, "*", 76]
          : key.includes("vehicle|registration|rentals|rental value|collected|outstanding|expenses|net collected")
            ? [118, 98, 54, 82, 82, 82, 82, "*"]
            : headers.map((_, index) => currencyColumns.includes(index) ? 78 : "*");

  const kpis: { label: string; value: string }[] = [{ label: "RECORDS", value: String(rows.length) }];
  if (key.includes("|paid|balance")) {
    kpis.push(
      { label: totalLabel.toUpperCase(), value: money(total) },
      { label: "COLLECTED", value: money(sumColumn("Paid")) },
      { label: "OUTSTANDING", value: money(sumColumn("Balance")) },
    );
  } else if (key.includes("rental value|collected|outstanding|expenses|net collected")) {
    kpis.push(
      { label: "RENTAL VALUE", value: money(sumColumn("Rental value")) },
      { label: "COLLECTED", value: money(sumColumn("Collected")) },
      { label: "NET COLLECTED", value: money(sumColumn("Net collected")) },
    );
  } else if (key.includes("payment|customer|rental|date|method|amount|received by")) {
    kpis.push(
      { label: "COLLECTED", value: money(total) },
      { label: "CUSTOMERS", value: String(uniqueCount("Customer")) },
      { label: "RECEIVED BY", value: CURRENT_USER_NAME },
    );
  } else if (key.includes("date|category|vehicle|method|amount|description")) {
    kpis.push(
      { label: "TOTAL EXPENSES", value: money(total) },
      { label: "VEHICLES", value: String(uniqueCount("Vehicle")) },
      { label: "CATEGORIES", value: String(uniqueCount("Category")) },
    );
  } else {
    kpis.push({ label: totalLabel.toUpperCase(), value: money(total) });
  }

  const body: any[][] = [
    headers.map((header) => ({ text: header.toUpperCase(), style: "tableHeader", fillColor: DEEP, color: "#ffffff" })),
    ...rows.map((row, rowIndex) => headers.map((_, columnIndex) => {
      const raw = row[columnIndex] ?? "";
      const isMoney = typeof raw === "number" && currencyColumns.includes(columnIndex);
      return {
        text: isMoney ? money(Number(raw)) : String(raw),
        alignment: isMoney ? "right" : "left",
        bold: isMoney,
        fillColor: rowIndex % 2 ? PAPER : "#ffffff",
        color: INK,
        margin: [0, 2, 0, 2],
      };
    })),
  ];

  const totalCells = headers.map((_, index) => {
    if (index === 0) return { text: totalLabel.toUpperCase(), bold: true, color: DEEP, fillColor: SOFT, colSpan: Math.max(1, headers.length - 1) };
    if (index < headers.length - 1) return {};
    return { text: money(total), bold: true, alignment: "right", color: DEEP, fillColor: SOFT };
  });
  body.push(totalCells);

  const doc: any = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 34],
    info: { title: `Mecardee - ${title}`, author: CURRENT_USER_NAME },
    content: [
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "MECARDEE RENTAL MANAGER", style: "brand" },
              { text: title.toUpperCase(), style: "title", margin: [0, 4, 0, 0] },
              { text: subtitle, style: "subtitle", margin: [0, 4, 0, 0] },
            ],
          },
          {
            width: 118,
            table: {
              widths: ["*"],
              body: [[{
                stack: [
                  { text: "GENERATED BY", style: "miniLabel" },
                  { text: CURRENT_USER_NAME, style: "miniValue" },
                  { text: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()), style: "miniText" },
                ],
                fillColor: SOFT,
                margin: [9, 7, 9, 7],
              }]],
            },
            layout: "noBorders",
          },
        ],
        columnGap: 16,
        margin: [0, 0, 0, 16],
      },
      {
        columns: kpis.slice(0, 4).map((kpi) => ({
          width: "*",
          table: {
            widths: ["*"],
            body: [[{
              stack: [
                { text: kpi.label, style: "kpiLabel" },
                { text: kpi.value, style: "kpiValue", margin: [0, 3, 0, 0] },
              ],
              fillColor: SOFT,
              margin: [10, 8, 10, 8],
            }]],
          },
          layout: "noBorders",
        })),
        columnGap: 10,
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: reportWidths,
          body,
        },
        layout: {
          hLineWidth: (i: number, node: any) => i === 0 || i === node.table.body.length ? 0 : 0.45,
          vLineWidth: () => 0,
          hLineColor: () => LINE,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
    ],
    styles: {
      brand: { fontSize: 8, bold: true, color: DEEP, characterSpacing: 0.8 },
      title: { fontSize: 19, bold: true, color: DEEP },
      subtitle: { fontSize: 8.5, color: MUTED },
      kpiLabel: { fontSize: 7.5, bold: true, color: MUTED },
      kpiValue: { fontSize: 14, bold: true, color: INK },
      tableHeader: { fontSize: 7.4, bold: true },
      miniLabel: { fontSize: 6.5, bold: true, color: MUTED },
      miniValue: { fontSize: 9, bold: true, color: INK },
      miniText: { fontSize: 6.5, color: MUTED, margin: [0, 2, 0, 0] },
    },
    defaultStyle: { font: "Roboto", fontSize: 7.5, color: INK },
    footer(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: "Mecardee Rental Manager", alignment: "left" },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: "right" },
        ],
        margin: [28, 8, 28, 0],
        fontSize: 7,
        color: MUTED,
      };
    },
  };

  pdfMakeClient.createPdf(doc).download(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

function customerReportDateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function ReportsView({ rentals, payments, expenses, vehicles }: { rentals: Rental[]; payments: PaymentRow[]; expenses: ExpenseRow[]; vehicles: Vehicle[] }) {
  const today = dateInputValue(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  const [reportType, setReportType] = useState<ReportType>("rentals");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<string[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [paidByFilter, setPaidByFilter] = useState("all");
  const [reportUsers, setReportUsers] = useState<{ username: string; role: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/users", { cache: "no-store" });
        const payload = await readApiResponse<{ ok: boolean; users?: { username: string; role: string }[] }>(response);
        if (!cancelled && response.ok) setReportUsers(payload.users ?? []);
      } catch {
        if (!cancelled) setReportUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const paidByChoices = useMemo(() => {
    const names = new Map<string, string>();
    for (const user of reportUsers) names.set(user.username.toLowerCase(), user.username);
    for (const payment of payments) if (payment.receivedBy) names.set(payment.receivedBy.toLowerCase(), payment.receivedBy);
    for (const expense of expenses) if (expense.createdBy) names.set(expense.createdBy.toLowerCase(), expense.createdBy);
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [reportUsers, payments, expenses]);

  const customerChoices = useMemo(() => {
    const choices = new Map<string, { key: string; name: string; phone: string }>();
    for (const rental of rentals) {
      const normalizedPhone = String(rental.phone || "").replace(/\D/g, "");
      const key = normalizedPhone ? `phone:${normalizedPhone}` : `name:${String(rental.customer || "").trim().toLowerCase()}`;
      if (!choices.has(key)) {
        choices.set(key, { key, name: rental.customer || "Unknown customer", phone: rental.phone || "" });
      }
    }
    return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rentals]);

  const toggleCustomer = (customerKey: string) => setSelectedCustomerKeys((current) =>
    current.includes(customerKey) ? current.filter((key) => key !== customerKey) : [...current, customerKey]
  );

  const visibleCustomerChoices = customerChoices.filter((customer) => {
    const term = customerSearch.trim().toLowerCase();
    return !term || customer.name.toLowerCase().includes(term) || customer.phone.toLowerCase().includes(term);
  });

  const toggleVehicle = (vehicleId: string) => setSelectedVehicleIds((current) => current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]);

  const report = useMemo(() => {
    const within = (value: string) => {
      const day = value ? value.slice(0, 10) : "";
      return (!dateFrom || !day || day >= dateFrom) && (!dateTo || !day || day <= dateTo);
    };
    const ownSegments = (rental: Rental) => rental.segments.filter((segment) => !segment.isGuest);
    const ownWeight = (rental: Rental) => ownSegments(rental).reduce((sum, segment) => sum + Math.max(0, segment.rentalCharge + segment.extraKmCharge), 0);
    const vehicleShare = (rental: Rental, vehicleId: string) => {
      const segments = ownSegments(rental);
      if (!segments.some((segment) => segment.vehicleId === vehicleId)) return 0;
      if (segments.length === 1) return 1;
      const totalWeight = ownWeight(rental);
      const selectedWeight = segments.filter((segment) => segment.vehicleId === vehicleId).reduce((sum, segment) => sum + Math.max(0, segment.rentalCharge + segment.extraKmCharge), 0);
      if (totalWeight > 0) return selectedWeight / totalWeight;
      const vehicleSegmentCount = segments.filter((segment) => segment.vehicleId === vehicleId).length;
      return vehicleSegmentCount / Math.max(1, segments.length);
    };

    if (reportType === "payments") {
      // snapshot payment rows already exclude the Guest Car financial portion.
      const filtered = payments.filter((payment) => within(payment.receivedAt) && (paidByFilter === "all" || payment.receivedBy.toLowerCase() === paidByFilter.toLowerCase()));
      return { title: "Payments report", headers: ["Payment", "Customer", "Rental", "Date", "Method", "Amount", "Paid by"], rows: filtered.map((payment) => [payment.id, payment.customer, payment.rental, payment.date, payment.method, payment.amount, payment.receivedBy] as (string | number)[]), currencyColumns: [5], total: filtered.reduce((sum, payment) => sum + payment.amount, 0), label: "Collected" };
    }
    if (reportType === "expenses") {
      const rentalById = new Map(rentals.map((rental) => [rental.databaseId, rental]));
      const filtered = expenses.filter((expense) => within(expense.rawDate));
      return {
        title: "Expenses report",
        headers: ["Date", "Category", "Vehicle", "Associated rental", "Paid by", "Method", "Amount", "Description"],
        rows: filtered.map((expense) => {
          const linkedRental = expense.bookingId ? rentalById.get(expense.bookingId) : null;
          const associatedRental = linkedRental ? `${linkedRental.id} · ${linkedRental.vehicle} · ${linkedRental.customer}` : "—";
          return [expense.date, expense.category, expense.vehicle, associatedRental, expense.createdBy, expense.method, expense.amount, expense.description] as (string | number)[];
        }),
        currencyColumns: [6],
        total: filtered.reduce((sum, expense) => sum + expense.amount, 0),
        label: "Expenses",
      };
    }
    if (reportType === "cars") {
      // Company vehicle report. Guest Cars remain excluded from business income.
      const chosen = selectedVehicleIds.length ? vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)) : vehicles;
      const rentalMap = new Map(rentals.map((rental) => [rental.id, rental]));
      const periodRentals = rentals.filter((rental) => within(rental.startAt));
      const periodPayments = payments.filter((payment) => within(payment.receivedAt));
      const periodExpenses = expenses.filter((expense) => Boolean(expense.vehicleId && within(expense.rawDate)));

      const rows = chosen.map((vehicle) => {
        const carRentals = periodRentals.filter((rental) => vehicleShare(rental, vehicle.id) > 0);
        const customerNames = [...new Set(carRentals.map((rental) => rental.customer).filter(Boolean))].join(", ") || "—";
        const rentalDates = carRentals.map((rental) => formatIndiaWhen(rental.startAt)).join(", ") || "—";
        const rentalValue = carRentals.reduce((sum, rental) => sum + rental.businessFinancialTotal * vehicleShare(rental, vehicle.id), 0);
        const collected = periodPayments.reduce((sum, payment) => {
          const rental = rentalMap.get(payment.rental);
          return sum + (rental ? payment.amount * vehicleShare(rental, vehicle.id) : 0);
        }, 0);
        const outstanding = carRentals.reduce((sum, rental) => sum + rental.businessBalance * vehicleShare(rental, vehicle.id), 0);
        const carExpenses = periodExpenses.filter((expense) => expense.vehicleId === vehicle.id).reduce((sum, expense) => sum + expense.amount, 0);

        return [
          vehicle.name,
          vehicle.plate,
          customerNames,
          rentalDates,
          carRentals.length,
          rentalValue,
          collected,
          outstanding,
          carExpenses,
          collected - carExpenses,
        ] as (string | number)[];
      });

      return {
        title: "Car-wise report",
        headers: ["Vehicle", "Registration", "Customer", "Rental date", "Rentals", "Rental value", "Collected", "Outstanding", "Expenses", "Net collected"],
        rows,
        currencyColumns: [5, 6, 7, 8, 9],
        total: rows.reduce((sum, row) => sum + Number(row[9] ?? 0), 0),
        label: "Net collected",
      };
    }

    if (reportType === "customers") {
      const selectedSet = new Set(selectedCustomerKeys);
      const filteredRentals = rentals.filter((rental) => {
        if (!within(rental.startAt)) return false;
        const normalizedPhone = String(rental.phone || "").replace(/\D/g, "");
        const key = normalizedPhone ? `phone:${normalizedPhone}` : `name:${String(rental.customer || "").trim().toLowerCase()}`;
        return !selectedSet.size || selectedSet.has(key);
      });

      const grouped = new Map<string, Rental[]>();
      for (const rental of filteredRentals) {
        const normalizedPhone = String(rental.phone || "").replace(/\D/g, "");
        const key = normalizedPhone ? `phone:${normalizedPhone}` : `name:${String(rental.customer || "").trim().toLowerCase()}`;
        const current = grouped.get(key) || [];
        current.push(rental);
        grouped.set(key, current);
      }

      const rows = [...grouped.values()]
        .map((customerRentals) => {
          const first = customerRentals[0];
          const vehiclesUsed = [...new Set(customerRentals.map((rental) => `${rental.originalVehicle} ${rental.originalPlate}`))].join(", ");
          const rentalDates = customerRentals.map((rental) => `${customerReportDateOnly(rental.startAt)} → ${customerReportDateOnly(rental.endAt)}`).join(", ");
          return [
            first.customer,
            first.phone,
            customerRentals.length,
            vehiclesUsed,
            rentalDates,
            customerRentals.reduce((sum, rental) => sum + rental.businessFinancialTotal, 0),
            customerRentals.reduce((sum, rental) => sum + rental.businessPaid, 0),
            customerRentals.reduce((sum, rental) => sum + rental.businessBalance, 0),
          ] as (string | number)[];
        })
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      return {
        title: "Customer-wise report",
        headers: ["Customer", "Phone", "Rentals", "Vehicles", "Rental dates", "Rental value", "Collected", "Outstanding"],
        rows,
        currencyColumns: [5, 6, 7],
        total: rows.reduce((sum, row) => sum + Number(row[5] ?? 0), 0),
        label: "Rental value",
      };
    }

    const base = rentals.filter((rental) => within(rental.startAt) && (status === "all" || rental.state === status));
    if (reportType === "outstanding") {
      const filtered = base.filter((rental) => rental.businessBalance > 0);
      return { title: "Outstanding balances", headers: ["Customer", "Phone", "Original vehicle", "Expected return", "Status", "Business balance"], rows: filtered.map((rental) => [rental.customer, rental.phone, `${rental.originalVehicle} ${rental.originalPlate}`, formatIndiaWhen(rental.endAt), rental.statusText, rental.businessBalance] as (string | number)[]), currencyColumns: [5], total: filtered.reduce((sum, rental) => sum + rental.businessBalance, 0), label: "Outstanding" };
    }
    return {
      title: "Rentals report",
      headers: ["Original vehicle", "Customer", "Start", "Return", "Status", "Business total", "Business paid", "Business balance", "Expenses", "Paid by", "Expense category"],
      rows: base.map((rental) => {
        const linkedExpenses = expenses.filter((expense) => expense.bookingId === rental.databaseId);
        const expenseTotal = linkedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const expenseUsers = [...new Set(linkedExpenses.map((expense) => expense.createdBy).filter(Boolean))].join(", ") || "—";
        const expenseCategories = [...new Set(linkedExpenses.map((expense) => expense.category).filter(Boolean))].join(", ") || "—";
        return [`${rental.originalVehicle} ${rental.originalPlate}`, rental.customer, formatIndiaWhen(rental.startAt), formatIndiaWhen(rental.endAt), rental.statusText, rental.businessFinancialTotal, rental.businessPaid, rental.businessBalance, expenseTotal, expenseUsers, expenseCategories] as (string | number)[];
      }),
      currencyColumns: [5, 6, 7, 8],
      total: base.reduce((sum, rental) => sum + rental.businessFinancialTotal, 0),
      label: "Rental value",
    };
  }, [reportType, dateFrom, dateTo, status, selectedVehicleIds, selectedCustomerKeys, paidByFilter, rentals, payments, expenses, vehicles]);

  const vehicleScope = selectedVehicleIds.length ? vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)).map((vehicle) => vehicle.plate).join(", ") : "All cars";
  const customerScope = selectedCustomerKeys.length
    ? customerChoices.filter((customer) => selectedCustomerKeys.includes(customer.key)).map((customer) => customer.name).join(", ")
    : "All customers";
  const subtitle = `${dateFrom || "Any date"} to ${dateTo || "Any date"}${reportType === "rentals" || reportType === "outstanding" ? ` · Status: ${status}` : ""}${reportType === "payments" ? ` · Paid by: ${paidByFilter === "all" ? "All users" : paidByFilter}` : ""}${reportType === "cars" ? ` · ${vehicleScope}` : ""}${reportType === "customers" ? ` · ${customerScope}` : ""}`;
  const exportName = `mecardee-${reportType}-${dateFrom || "all"}-${dateTo || "all"}`;


  // Browser keeps Status visible. Rentals PDF intentionally omits Status.
  const pdfStatusIndex = reportType === "rentals" ? report.headers.indexOf("Status") : -1;
  const pdfHeaders = pdfStatusIndex >= 0 ? report.headers.filter((_, index) => index !== pdfStatusIndex) : report.headers;
  const pdfRows = pdfStatusIndex >= 0 ? report.rows.map((row) => row.filter((_, index) => index !== pdfStatusIndex)) : report.rows;
  const pdfCurrencyColumns = pdfStatusIndex >= 0
    ? report.currencyColumns.map((index) => index > pdfStatusIndex ? index - 1 : index).filter((index) => index !== pdfStatusIndex)
    : report.currencyColumns;

  return <>
    <PageHeading eyebrow="INSIGHTS" title="Reports" description="Live business reports from your rental, payment and expense records." />
    <section className="report-filter-card">
      <div className="report-filter-grid">
        <label className="field mecardee-report-filter-field"><span>Report</span><select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}><option value="rentals">Rentals</option><option value="payments">Payments</option><option value="expenses">Expenses</option><option value="outstanding">Outstanding balances</option><option value="cars">Car-wise report</option><option value="customers">Customer-wise report</option></select></label>
        <label className="field"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {(reportType === "rentals" || reportType === "outstanding") && <label className="field mecardee-report-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="today">Returning today</option><option value="overdue">Overdue</option><option value="completed">Completed</option></select></label>}
        {reportType === "payments" && <label className="field mecardee-report-filter-field"><span>Paid by</span><select value={paidByFilter} onChange={(event) => setPaidByFilter(event.target.value)}><option value="all">All users</option>{paidByChoices.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>}
      </div>
      {reportType === "cars" && <div className="car-report-filter"><div><strong>Cars</strong><small>Select one or multiple company cars. Guest Cars are intentionally excluded from this income report.</small></div><button type="button" className="secondary-button" onClick={() => setSelectedVehicleIds([])}>All cars</button><div className="car-report-options">{vehicles.map((vehicle) => <label key={vehicle.id} className={selectedVehicleIds.includes(vehicle.id) ? "selected" : ""}><input type="checkbox" checked={selectedVehicleIds.includes(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} /><span><strong>{vehicle.name}</strong><small>{vehicle.plate}</small></span></label>)}</div></div>}
      {reportType === "customers" && <div className="customer-report-filter">
        <div className="customer-report-filter-head">
          <div><strong>Customers</strong><small>Search and select one or multiple customers. Leave empty for all customers.</small></div>
          <button type="button" className="secondary-button" onClick={() => { setSelectedCustomerKeys([]); setCustomerSearch(""); }}>All customers</button>
        </div>
        <details className="customer-multi-select">
          <summary>
            <span className="customer-multi-summary-icon"><UsersRound size={17} /></span>
            <span><strong>{selectedCustomerKeys.length ? `${selectedCustomerKeys.length} customer${selectedCustomerKeys.length === 1 ? "" : "s"} selected` : "All customers"}</strong><small>Tap to search or select customers</small></span>
            <ChevronDown size={17} />
          </summary>
          <div className="customer-multi-menu">
            <label className="customer-multi-search"><Search size={16} /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer or phone" /></label>
            <div className="customer-multi-meta"><span>{visibleCustomerChoices.length} shown</span><button type="button" onClick={() => setSelectedCustomerKeys([])}>Clear selection</button></div>
            <div className="customer-multi-options">
              {visibleCustomerChoices.length ? visibleCustomerChoices.map((customer) => <label key={customer.key} className={selectedCustomerKeys.includes(customer.key) ? "selected" : ""}>
                <input type="checkbox" checked={selectedCustomerKeys.includes(customer.key)} onChange={() => toggleCustomer(customer.key)} />
                <span><strong>{customer.name}</strong><small>{customer.phone || "No phone"}</small></span>
                <span className="customer-check">{selectedCustomerKeys.includes(customer.key) ? <Check size={14} /> : null}</span>
              </label>) : <div className="customer-multi-empty">No customer matches your search.</div>}
            </div>
          </div>
        </details>
      </div>}
      <div className="report-actions"><button className="secondary-button" onClick={() => downloadPdfTable(exportName, report.title, subtitle, pdfHeaders, pdfRows, pdfCurrencyColumns, report.label, report.total)} disabled={!report.rows.length}><FileText size={16} />PDF</button><button className="primary-button" onClick={() => downloadExcelTable(exportName, report.title, subtitle, report.headers, report.rows, report.currencyColumns, report.label, report.total)} disabled={!report.rows.length}><Download size={16} />Excel</button></div>
    </section>
    <section className="report-summary"><article><span>Rows</span><strong>{report.rows.length}</strong><small>{subtitle}</small></article><article><span>{report.label}</span><strong>{money(report.total)}</strong><small>Guest Car rental amounts excluded from business totals</small></article></section>
    <section className="data-panel report-results"><div className="panel-heading"><div><h2>{report.title}</h2><p>{report.rows.length ? `${report.rows.length} matching records` : "No records match these filters"}</p></div></div><div className="report-table-wrap"><table><thead><tr>{report.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row, rowIndex) => <tr key={`${reportType}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{typeof cell === "number" && report.currencyColumns.includes(cellIndex) ? money(cell) : cell}</td>)}</tr>)}</tbody></table></div></section>
  </>;
}

function SettingsView({ rentals, vehicles, bookings, lastSyncedAt, syncing, onSync, currentUser, onLogout }: { rentals: Rental[]; vehicles: Vehicle[]; bookings: BookingRecord[]; lastSyncedAt: Date | null; syncing: boolean; onSync: () => void; currentUser: AuthUser; onLogout: () => void }) {

  const [userAccessBusy, setUserAccessBusy] = useState(false);
  const [userAccessMessage, setUserAccessMessage] = useState("");
  const [userAccessError, setUserAccessError] = useState("");

  const changeOwnPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    setUserAccessError("");
    setUserAccessMessage("");

    if (newPassword !== confirmPassword) {
      setUserAccessError("New passwords do not match.");
      return;
    }

    setUserAccessBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await readApiResponse<{ ok: boolean; message?: string; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not change password.");
      setUserAccessMessage(payload.message || "Password changed successfully.");
      event.currentTarget.reset();
    } catch (changeError) {
      setUserAccessError(changeError instanceof Error ? changeError.message : "Could not change password.");
    } finally {
      setUserAccessBusy(false);
    }
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentUser.role !== "superadmin") return;

    const form = new FormData(event.currentTarget);
    const username = String(form.get("newUsername") || "").trim().toLowerCase();
    const password = String(form.get("newUserPassword") || "");
    const confirmPassword = String(form.get("confirmNewUserPassword") || "");
    const role = String(form.get("newUserRole") || "");

    setUserAccessError("");
    setUserAccessMessage("");

    if (password !== confirmPassword) {
      setUserAccessError("User passwords do not match.");
      return;
    }

    setUserAccessBusy(true);
    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const payload = await readApiResponse<{ ok: boolean; user?: AuthUser; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not create user.");
      setUserAccessMessage(`${payload.user?.username || username} created as ${role === "owner" ? "Owner" : "Viewer"}.`);
      event.currentTarget.reset();
    } catch (createError) {
      setUserAccessError(createError instanceof Error ? createError.message : "Could not create user.");
    } finally {
      setUserAccessBusy(false);
    }
  };
  const syncLabel = lastSyncedAt ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(lastSyncedAt) : "Not synced yet";
  const [tab, setTab] = useState<"bookings" | "rentals" | "payments" | "expenses" | "history">("rentals");
  const [data, setData] = useState<TransactionManagerData>({ ok: true, payments: [], expenses: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<{ type: "payment" | "expense"; record: ManagedPaymentTransaction | ManagedExpenseTransaction } | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ type: "payment" | "expense"; id: string; number: string; label: string } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [rentalEditTarget, setRentalEditTarget] = useState<Rental | null>(null);
  const [rentalScheduleForm, setRentalScheduleForm] = useState({ startAt: "", endAt: "" });
  // MECARDEE_RENTAL_CORRECTION_UNDO_START_V8_9_47
  const [rentalVehicleTarget, setRentalVehicleTarget] = useState<Rental | null>(null);
  const [rentalVehicleForm, setRentalVehicleForm] = useState({ vehicleId: "", startingKilometer: 0, startingFuelRangeKm: 0 });
  // MECARDEE_SETTINGS_BOOKING_EDITOR_V8_9_49
  const [bookingEditTarget, setBookingEditTarget] = useState<BookingRecord | null>(null);

  const formatWhen = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const toLocalDateTimeInput = (value: string) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings/transactions", { cache: "no-store" });
      const payload = await readApiResponse<TransactionManagerData>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load transactions.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (currentUser.role === "superadmin") void loadTransactions(); else { setLoading(false); setError(""); } }, [loadTransactions, currentUser.role]);

  const openEdit = (type: "payment" | "expense", record: ManagedPaymentTransaction | ManagedExpenseTransaction) => {
    setError("");
    setEditTarget({ type, record });
    if (type === "payment") {
      const payment = record as ManagedPaymentTransaction;
      setEditForm({ amount: String(payment.amount), method: payment.method, notes: payment.notes ?? "", receivedAt: toLocalDateTimeInput(payment.receivedAt) });
    } else {
      const expense = record as ManagedExpenseTransaction;
      setEditForm({ amount: String(expense.amount), method: expense.method, description: expense.description ?? "", category: expense.category, expenseDate: expense.expenseDate });
    }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;
    setBusy(true);
    setError("");
    try {
      const body = editTarget.type === "payment"
        ? { type: "payment", id: editTarget.record.id, amount: Number(editForm.amount), method: editForm.method, notes: editForm.notes, receivedAt: new Date(editForm.receivedAt).toISOString() }
        : { type: "expense", id: editTarget.record.id, amount: Number(editForm.amount), method: editForm.method, description: editForm.description, category: editForm.category, expenseDate: editForm.expenseDate };
      const response = await fetch("/api/settings/transactions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not edit the transaction.");
      setEditTarget(null);
      await loadTransactions();
      onSync();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not edit the transaction.");
    } finally {
      setBusy(false);
    }
  };

  const safeDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/transactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: deleteTarget.type, id: deleteTarget.id, reason: deleteReason }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not delete the transaction.");
      setDeleteTarget(null);
      setDeleteReason("");
      setTab("history");
      await loadTransactions();
      onSync();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the transaction.");
    } finally {
      setBusy(false);
    }
  };

  const restoreDeleted = async (history: DeletedTransactionHistory) => {
    if (!window.confirm(`Restore ${history.transactionNumber || history.transactionType}?`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", historyId: history.id }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not restore the transaction.");
      await loadTransactions();
      onSync();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Could not restore the transaction.");
    } finally {
      setBusy(false);
    }
  };

  const editableBookings = useMemo(() => bookings.filter((booking) => booking.status === "booked").sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [bookings]);
  const editableRentals = rentals.filter((rental) => rental.state !== "completed");

  const openRentalScheduleEdit = (rental: Rental) => {
    setError("");
    setRentalEditTarget(rental);
    setRentalScheduleForm({
      startAt: toLocalDateTimeInput(rental.startAt),
      endAt: toLocalDateTimeInput(rental.endAt),
    });
  };

  const saveRentalSchedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rentalEditTarget) return;
    setBusy(true);
    setError("");
    try {
      const startAt = new Date(rentalScheduleForm.startAt);
      const endAt = new Date(rentalScheduleForm.endAt);
      if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw new Error("Please enter valid rental dates and times.");
      if (endAt <= startAt) throw new Error("Expected return must be after the start date/time.");
      const response = await fetch("/api/settings/rentals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: rentalEditTarget.databaseId, startAt: startAt.toISOString(), endAt: endAt.toISOString() }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; rentalDays?: number; baseRentalAmount?: number; scheduleWarning?: string | null }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not update rental schedule.");
      setRentalEditTarget(null);
      if (payload.scheduleWarning) window.setTimeout(() => window.alert(`Rental schedule saved.\n\n${payload.scheduleWarning}`), 50);
      onSync();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update rental schedule.");
    } finally {
      setBusy(false);
    }
  };

  const openRentalVehicleCorrection = (rental: Rental) => {
    setError("");
    setRentalVehicleTarget(rental);
    setRentalVehicleForm({
      vehicleId: rental.vehicleId,
      startingKilometer: rental.startingKilometer,
      startingFuelRangeKm: rental.startingFuelRangeKm,
    });
  };

  const saveRentalVehicleCorrection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rentalVehicleTarget) return;
    setBusy(true);
    setError("");
    try {
      if (!rentalVehicleForm.vehicleId) throw new Error("Choose the correct vehicle.");
      const response = await fetch("/api/settings/rentals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "correct-vehicle",
          bookingId: rentalVehicleTarget.databaseId,
          vehicleId: rentalVehicleForm.vehicleId,
          startingKilometer: rentalVehicleForm.startingKilometer,
          startingFuelRangeKm: rentalVehicleForm.startingFuelRangeKm,
        }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; vehicle?: string; plate?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not correct the rental vehicle.");
      setRentalVehicleTarget(null);
      onSync();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not correct the rental vehicle.");
    } finally {
      setBusy(false);
    }
  };

  const undoRentalStart = async (rental: Rental) => {
    const confirmed = window.confirm(
      `Undo the rental start for ${rental.id}?\n\nThis will return the record to BOOKED, remove the single active rental segment, release ${rental.vehicle}, and remove only the handover advance payment if one was created. Use this only for a mistaken rental start.`
    );
    if (!confirmed) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/rentals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: rental.databaseId }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; bookingNumber?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not undo the rental start.");
      onSync();
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Could not undo the rental start.");
    } finally {
      setBusy(false);
    }
  };

  const paymentRows = data.payments;
  const expenseRows = data.expenses;
  const historyRows = data.history;

  return <>
    <PageHeading eyebrow="APP" title="Settings" description="Sync live data, edit active bookings, safely correct rentals, and manage transaction corrections without touching the database directly." />
    <section className="settings-grid">
      <article className="settings-card"><span className="settings-icon"><RefreshCw size={19} /></span><div><h3>Live data sync</h3><p>Last synced: {syncLabel}. The app also refreshes automatically after saves and settlements.</p></div><button className="secondary-button" onClick={onSync} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "Syncing…" : "Sync now"}</button></article>
      <article className={`settings-card transaction-safety ${currentUser.role === "superadmin" ? "" : "role-hidden-correction"}`}><span className="settings-icon"><ShieldCheck size={19} /></span><div><h3>Safe corrections</h3><p>Active bookings can be edited here, including reserved vehicle and booking period. Active rental corrections stay protected, completed settlements stay locked, and payments/expenses keep their existing edit/delete history protection.</p></div></article>
    </section>

        <section className="data-panel user-access-manager">
      <div className="panel-heading user-access-heading">
        <div>
          <h2>User access</h2>
          <p>Signed in as <strong>{currentUser.username}</strong> - {currentUser.role === "superadmin" ? "Super Admin" : currentUser.role === "owner" ? "Owner" : "Viewer"}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>Log out</button>
      </div>

      {(userAccessMessage || userAccessError) && <div className={userAccessError ? "user-access-feedback error" : "user-access-feedback success"}>{userAccessError || userAccessMessage}</div>}

      <div className="user-access-grid">
        <article className="user-access-card">
          <span className="settings-icon"><ShieldCheck size={19} /></span>
          <div className="user-access-copy">
            <h3>Change password</h3>
            <p>Update the password for your own account.</p>
          </div>
          <form className="user-access-form" onSubmit={changeOwnPassword}>
            <label><span>Current password</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
            <label><span>New password</span><input name="newPassword" type="password" minLength={4} autoComplete="new-password" required /></label>
            <label><span>Confirm new password</span><input name="confirmPassword" type="password" minLength={4} autoComplete="new-password" required /></label>
            <button className="primary-button" type="submit" disabled={userAccessBusy}>{userAccessBusy ? "Saving..." : "Change password"}</button>
          </form>
        </article>

        {currentUser.role === "superadmin" && <article className="user-access-card">
          <span className="settings-icon"><UserRoundPlus size={19} /></span>
          <div className="user-access-copy">
            <h3>Create new user</h3>
            <p>Create an Owner or Viewer. Super Admin is reserved for the admin account.</p>
          </div>
          <form className="user-access-form" onSubmit={createUser}>
            <label><span>Username</span><input name="newUsername" minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" autoComplete="off" required /></label>
            <label><span>Role</span><select name="newUserRole" defaultValue="owner" required><option value="owner">Owner</option><option value="viewer">Viewer</option></select></label>
            <label><span>Password</span><input name="newUserPassword" type="password" minLength={4} autoComplete="new-password" required /></label>
            <label><span>Confirm password</span><input name="confirmNewUserPassword" type="password" minLength={4} autoComplete="new-password" required /></label>
            <button className="primary-button" type="submit" disabled={userAccessBusy}>{userAccessBusy ? "Creating..." : "Create user"}</button>
          </form>
        </article>}
      </div>
    </section>

<section className={`data-panel transaction-manager ${currentUser.role === "superadmin" ? "" : "role-hidden-correction"}`}>
      <div className="panel-heading transaction-manager-head"><div><h2>Correction manager</h2><p>Active bookings + rental corrections + latest payments and expenses · completed records stay protected</p></div><button className="secondary-button" onClick={() => void loadTransactions()} disabled={loading || busy}><RefreshCw size={15} className={loading ? "spin" : ""} />Refresh</button></div>
      <div className="transaction-tabs">
        <button className={tab === "rentals" ? "active" : ""} onClick={() => setTab("rentals")}><CalendarRange size={15} />Rental dates <span>{editableRentals.length}</span></button>
        <button className={tab === "bookings" ? "active" : ""} onClick={() => setTab("bookings")}><CalendarDays size={15} />Bookings <span>{editableBookings.length}</span></button>
        <button className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}><WalletCards size={15} />Payments <span>{paymentRows.length}</span></button>
        <button className={tab === "expenses" ? "active" : ""} onClick={() => setTab("expenses")}><ReceiptIndianRupee size={15} />Expenses <span>{expenseRows.length}</span></button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={15} />Delete history <span>{historyRows.length}</span></button>
      </div>
      {error && <p className="form-error transaction-manager-error">{error}</p>}
      {loading ? <div className="transaction-empty"><RefreshCw className="spin" size={18} />Loading transactions…</div> : <div className="transaction-list">
        {tab === "bookings" && (editableBookings.length ? editableBookings.map((booking) => <article className="transaction-row settings-booking-row" key={booking.id}><div className="transaction-main"><span className="transaction-kind rental"><CalendarDays size={15} /></span><div><strong>{booking.vehicle} · {booking.plate}</strong><small>{booking.bookingNumber} · {booking.customer}</small><small>{formatWhen(booking.startAt)} → {formatWhen(booking.endAt)} · {booking.days} rental day{booking.days === 1 ? "" : "s"} · {money(booking.rate)}/day</small>{booking.vehicleId !== booking.requestedVehicleId && <small className="settings-booking-original">Original request: {booking.requestedVehicle} · {booking.requestedPlate}</small>}</div></div><div className="transaction-side"><span className="settings-booking-status">Booked</span><div className="transaction-actions"><button onClick={() => { setError(""); setBookingEditTarget(booking); }} disabled={busy}><Pencil size={14} />Edit booking</button></div></div></article>) : <div className="transaction-empty">No active bookings to edit.</div>)}
        {tab === "rentals" && (editableRentals.length ? editableRentals.map((rental) => <article className="transaction-row rental-schedule-row" key={rental.databaseId}><div className="transaction-main"><span className="transaction-kind rental"><CalendarRange size={15} /></span><div><strong>{rental.vehicle} · {rental.plate}</strong><small>{rental.id} · {rental.customer}</small><small>{formatWhen(rental.startAt)} → {formatWhen(rental.endAt)} · {rental.days} rental day{rental.days === 1 ? "" : "s"}</small>{rental.segments.length === 1 && rental.vehicleId !== rental.originalVehicleId && <small className="rental-correction-warning">Started on a different vehicle · original booking: {rental.originalVehicle} · {rental.originalPlate}</small>}</div></div><div className="transaction-side"><span className={`rental-schedule-status ${rental.state}`}>{rental.state === "overdue" ? "Overdue / on rent" : rental.state === "today" ? "On rent · due today" : "On rent"}</span><div className="transaction-actions rental-correction-actions"><button onClick={() => openRentalScheduleEdit(rental)} disabled={busy}><CalendarRange size={14} />Date & time</button>{rental.segments.length === 1 && <button onClick={() => openRentalVehicleCorrection(rental)} disabled={busy}><CarFront size={14} />Correct vehicle</button>}{rental.segments.length === 1 && <button className="danger" onClick={() => void undoRentalStart(rental)} disabled={busy}><RotateCcw size={14} />Undo start</button>}</div></div></article>) : <div className="transaction-empty">No active rentals to edit.</div>)}
        {tab === "payments" && (paymentRows.length ? paymentRows.map((payment) => <article className="transaction-row" key={payment.id}><div className="transaction-main"><span className="transaction-kind payment"><WalletCards size={15} /></span><div><strong>{payment.customer}</strong><small>{payment.number} · Rental {payment.bookingNumber}</small><small>{formatWhen(payment.receivedAt)} · {payment.method} · Received by {payment.receivedBy}</small>{payment.notes && <small>{payment.notes}</small>}</div></div><div className="transaction-side"><strong>{money(payment.amount)}</strong><div className="transaction-actions"><button onClick={() => openEdit("payment", payment)} disabled={busy}><Pencil size={14} />Edit</button><button className="danger" onClick={() => { setDeleteReason(""); setDeleteTarget({ type: "payment", id: payment.id, number: payment.number, label: `${payment.customer} · ${money(payment.amount)}` }); }} disabled={busy}><Trash2 size={14} />Delete</button></div></div></article>) : <div className="transaction-empty">No payment transactions.</div>)}
        {tab === "expenses" && (expenseRows.length ? expenseRows.map((expense) => <article className="transaction-row" key={expense.id}><div className="transaction-main"><span className="transaction-kind expense"><ReceiptIndianRupee size={15} /></span><div><strong>{expense.category}</strong><small>{expense.number}{expense.plate ? ` · ${expense.plate}` : " · General expense"}</small><small>{expense.expenseDate} · {expense.method} · Added by {expense.createdBy}</small>{expense.description && <small>{expense.description}</small>}</div></div><div className="transaction-side"><strong>{money(expense.amount)}</strong><div className="transaction-actions"><button onClick={() => openEdit("expense", expense)} disabled={busy}><Pencil size={14} />Edit</button><button className="danger" onClick={() => { setDeleteReason(""); setDeleteTarget({ type: "expense", id: expense.id, number: expense.number, label: `${expense.category} · ${money(expense.amount)}` }); }} disabled={busy}><Trash2 size={14} />Delete</button></div></div></article>) : <div className="transaction-empty">No expense transactions.</div>)}
        {tab === "history" && (historyRows.length ? historyRows.map((history) => <article className={`transaction-row transaction-history-row ${history.restoredAt ? "restored" : ""}`} key={history.id}><div className="transaction-main"><span className="transaction-kind history"><History size={15} /></span><div><strong>{history.transactionNumber || `${history.transactionType} transaction`}</strong><small>{history.displayLabel}</small><small>Deleted {formatWhen(history.deletedAt)} by {history.deletedBy} · Reason: {history.reason}</small>{history.restoredAt && <small className="restored-note">Restored {formatWhen(history.restoredAt)}{history.restoredBy ? ` by ${history.restoredBy}` : ""}</small>}</div></div><div className="transaction-side"><span className={`history-status ${history.restoredAt ? "restored" : "deleted"}`}>{history.restoredAt ? "Restored" : "Deleted"}</span>{!history.restoredAt && <div className="transaction-actions"><button onClick={() => void restoreDeleted(history)} disabled={busy}><RotateCcw size={14} />Restore</button></div>}</div></article>) : <div className="transaction-empty">Nothing has been deleted from Transaction Manager.</div>)}
      </div>}
    </section>


    {bookingEditTarget && <BookingEditDialog booking={bookingEditTarget} vehicles={vehicles.filter((vehicle) => !vehicle.isGuest)} guestVehicles={vehicles.filter((vehicle) => vehicle.isGuest)} bookings={bookings} rentals={rentals} close={() => !busy && setBookingEditTarget(null)} done={(message) => { setBookingEditTarget(null); onSync(); window.setTimeout(() => window.alert(message), 60); }} />}

    {rentalVehicleTarget && <DialogShell title="Correct active rental vehicle" subtitle={`${rentalVehicleTarget.id} · ${rentalVehicleTarget.customer}`} close={() => !busy && setRentalVehicleTarget(null)}><form className="simple-form rental-vehicle-correction-form" onSubmit={saveRentalVehicleCorrection}>
      <div className="delete-warning correction-warning"><AlertTriangle size={18} /><div><strong>Use this only to correct a mistaken rental start</strong><p>If the customer genuinely changes vehicles later during the rental, use the normal <b>Change Vehicle</b> action from Rental details so both vehicle periods remain in history.</p></div></div>
      <div className="protected-link-note"><ShieldCheck size={15} /><span><strong>Current assignment</strong><small>{rentalVehicleTarget.vehicle} · {rentalVehicleTarget.plate} · Original booking: {rentalVehicleTarget.originalVehicle} · {rentalVehicleTarget.originalPlate}</small></span></div>
      <div className="field-grid">
        <label className="field span-2"><span>Correct active vehicle</span><select required value={rentalVehicleForm.vehicleId} onChange={(event) => { const vehicleId = event.target.value; const selected = vehicles.find((vehicle) => vehicle.id === vehicleId); setRentalVehicleForm((current) => ({ ...current, vehicleId, startingKilometer: selected?.odometerKm ?? current.startingKilometer })); }}><optgroup label="Company vehicles">{vehicles.filter((vehicle) => !vehicle.isGuest).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} — {vehicle.plate} · {vehicle.status}</option>)}</optgroup>{vehicles.some((vehicle) => vehicle.isGuest) && <optgroup label="Guest Cars">{vehicles.filter((vehicle) => vehicle.isGuest).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} — {vehicle.plate} · Guest Car</option>)}</optgroup>}</select><small>Choosing another car here corrects the first active segment; it does not create a second segment.</small></label>
        <label className="field"><span>Starting KM</span><input required min="0" type="number" value={blankZero(rentalVehicleForm.startingKilometer)} onKeyDown={numericKeyOnly} onChange={(event) => setRentalVehicleForm((current) => ({ ...current, startingKilometer: numberFromInput(event.target.value) }))} /></label>
        <label className="field"><span>Starting fuel range (KM)</span><input required min="0" type="number" value={blankZero(rentalVehicleForm.startingFuelRangeKm)} onKeyDown={numericKeyOnly} onChange={(event) => setRentalVehicleForm((current) => ({ ...current, startingFuelRangeKm: numberFromInput(event.target.value) }))} /></label>
      </div>
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setRentalVehicleTarget(null)} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy || !rentalVehicleForm.vehicleId}><Check size={15} />{busy ? "Correcting…" : "Save vehicle correction"}</button></div>
    </form></DialogShell>}

    {rentalEditTarget && <DialogShell title="Edit rental date & time" subtitle={`${rentalEditTarget.vehicle} · ${rentalEditTarget.plate} · ${rentalEditTarget.customer}`} close={() => !busy && setRentalEditTarget(null)}><form className="simple-form" onSubmit={saveRentalSchedule}>
      <div className="protected-link-note"><ShieldCheck size={15} /><span><strong>Schedule-only correction</strong><small>Vehicle, customer, payments, kilometres and settlement data cannot be changed here. Completed rentals are locked.</small></span></div>
      <div className="field-grid"><label className="field"><span>Rental start date / time</span><input required type="datetime-local" value={rentalScheduleForm.startAt} onChange={(event) => setRentalScheduleForm((current) => ({ ...current, startAt: event.target.value }))} /></label><label className="field"><span>Expected return date / time</span><input required type="datetime-local" value={rentalScheduleForm.endAt} onChange={(event) => setRentalScheduleForm((current) => ({ ...current, endAt: event.target.value }))} /></label></div>
      <div className="rental-edit-note"><CalendarDays size={16} /><span>Rental days and rental amount will recalculate automatically from the new schedule using the same daily rate and existing discount. A future booking overlap is allowed and will be marked as Change required in the calendar. Only an actual active-rental collision or an invalid payment total is blocked.</span></div>
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setRentalEditTarget(null)} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><Check size={15} />{busy ? "Saving…" : "Save rental schedule"}</button></div>
    </form></DialogShell>}

    {editTarget && <DialogShell title={`Edit ${editTarget.type}`} subtitle="Linked rental/customer/vehicle stays locked for workflow safety" close={() => !busy && setEditTarget(null)}><form className="simple-form" onSubmit={saveEdit}>
      {editTarget.type === "payment" ? <>
        <div className="protected-link-note"><ShieldCheck size={15} /><span><strong>Protected link</strong><small>{(editTarget.record as ManagedPaymentTransaction).customer} · Rental {(editTarget.record as ManagedPaymentTransaction).bookingNumber}</small></span></div>
        <div className="field-grid"><label className="field"><span>Amount (₹)</span><input required min="0.01" step="0.01" type="number" inputMode="decimal" value={editForm.amount ?? ""} onKeyDown={numericKeyOnly} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} /></label><label className="field"><span>Payment method</span><select value={editForm.method ?? "Cash"} onChange={(event) => setEditForm((current) => ({ ...current, method: event.target.value }))}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label><label className="field span-2"><span>Received date / time</span><input required type="datetime-local" value={editForm.receivedAt ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, receivedAt: event.target.value }))} /></label></div><label className="field"><span>Notes</span><textarea value={editForm.notes ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      </> : <>
        <div className="protected-link-note"><ShieldCheck size={15} /><span><strong>Protected link</strong><small>{(editTarget.record as ManagedExpenseTransaction).plate ? `Vehicle ${(editTarget.record as ManagedExpenseTransaction).plate}` : "General expense"} · vehicle link cannot be changed here</small></span></div>
        <div className="field-grid"><label className="field"><span>Expense date</span><input required type="date" value={editForm.expenseDate ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, expenseDate: event.target.value }))} /></label><label className="field"><span>Category</span><select value={editForm.category ?? "Other"} onChange={(event) => setEditForm((current) => ({ ...current, category: event.target.value }))}><option>Vehicle service</option><option>Repair</option><option>Insurance</option><option>Fuel</option><option>Cleaning</option><option>Office expense</option><option>Other</option></select></label><label className="field"><span>Amount (₹)</span><input required min="0.01" step="0.01" type="number" inputMode="decimal" value={editForm.amount ?? ""} onKeyDown={numericKeyOnly} onChange={(event) => setEditForm((current) => ({ ...current, amount: event.target.value }))} /></label><label className="field"><span>Payment method</span><select value={editForm.method ?? "Cash"} onChange={(event) => setEditForm((current) => ({ ...current, method: event.target.value }))}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div><label className="field"><span>Description</span><textarea value={editForm.description ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} /></label>
      </>}
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setEditTarget(null)} disabled={busy}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><Check size={15} />{busy ? "Saving…" : "Save correction"}</button></div>
    </form></DialogShell>}

    {deleteTarget && <DialogShell title="Delete transaction safely" subtitle={deleteTarget.number} close={() => !busy && setDeleteTarget(null)}><form className="simple-form" onSubmit={safeDelete}><div className="delete-warning"><AlertTriangle size={18} /><div><strong>{deleteTarget.label}</strong><p>This deletes only this {deleteTarget.type}. The rental, customer, vehicle, return settlement and other workflow records are not deleted. A complete copy is stored in Delete history first and can be restored.</p></div></div><label className="field"><span>Reason for deletion</span><textarea required minLength={3} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Example: Duplicate payment entered by mistake" /></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</button><button className="danger-button" type="submit" disabled={busy || deleteReason.trim().length < 3}><Trash2 size={15} />{busy ? "Deleting safely…" : "Delete transaction"}</button></div></form></DialogShell>}
  </>;
}

function InstallAppPrompt({ ready, onInstall, onClose }: { ready: boolean; onInstall: () => void; onClose: () => void }) {
  return <aside className="install-app-prompt" role="dialog" aria-label="Install Mecardee app"><span className="brand-mark">M</span><div><strong>Install Mecardee</strong><small>{ready ? "Add Mecardee to your Android home screen for faster access." : "Install Mecardee from Chrome for an app-like experience."}</small></div><button className="install-now" onClick={onInstall}>Install</button><button className="install-close" onClick={onClose} aria-label="Dismiss install prompt"><X size={16} /></button></aside>;
}

function expenseIcon(category: string): LucideIcon {
  const value = category.toLowerCase();
  if (value.includes("service") || value.includes("repair")) return Wrench;
  if (value.includes("clean")) return Sparkles;
  if (value.includes("insurance")) return ShieldCheck;
  if (value.includes("fuel")) return Fuel;
  return FileText;
}

function AccountsView({ expenses, metrics }: { expenses: ExpenseRow[]; metrics: Metrics }) {
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const chart = metrics.monthlyCollected.length ? metrics.monthlyCollected : Array.from({ length: 12 }, (_, index) => ({ key: String(index), label: "—", amount: 0 }));
  const max = Math.max(1, ...chart.map((item) => item.amount));
  const year = metrics.monthlyCollected.at(-1)?.key.slice(0, 4) ?? new Date().getFullYear();
  const shownExpenses = showAllExpenses ? expenses : expenses.slice(0, 12);
  return <>
    <PageHeading eyebrow="MONEY & ACCOUNTS" title="Business overview" description="Simple income and expenses—only what you need to understand the business." />
    <section className="accounts-summary"><article><span>Rental revenue</span><strong>{money(metrics.rentalRevenueMonth)}</strong><small className="green-text"><TrendingUp size={13} /> Current month</small></article><article><span>Amount collected</span><strong>{money(metrics.collectedMonth)}</strong><small>{metrics.rentalRevenueMonth ? Math.round((metrics.collectedMonth / metrics.rentalRevenueMonth) * 1000) / 10 : 0}% collection rate</small></article><article><span>Pending amount</span><strong>{money(metrics.outstanding)}</strong><small className="red-text">{metrics.outstandingRentals} open balances</small></article><article><span>Total expenses</span><strong>{money(metrics.expensesMonth)}</strong><small>Recorded this month</small></article><article className="net"><span>Approx. net income</span><strong>{money(metrics.netIncomeMonth)}</strong><small>Collected income less recorded expenses</small></article></section>
    <div className="accounts-layout"><section className="data-panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Income collected over the last 12 months</p></div><button>{year} <ChevronDown size={14} /></button></div><div className="chart-total"><span>Total collected</span><strong>{money(metrics.twelveMonthCollected)}</strong></div><div className="bar-chart">{chart.map((item, index) => <div key={item.key}><span style={{ height: `${Math.max(4, Math.round((item.amount / max) * 100))}%` }} className={index === chart.length - 1 ? "current" : ""} /><small>{item.label}</small></div>)}</div></section><section className="data-panel expense-panel"><div className="panel-heading"><div><h2>{showAllExpenses ? "All expenses" : "Recent expenses"}</h2><p>{showAllExpenses ? `${expenses.length} recorded expenses` : `${money(metrics.expensesMonth)} recorded this month`}</p></div></div><div className="expense-list">{shownExpenses.map((expense) => { const Icon = expenseIcon(expense.category); return <article key={expense.id}><span className="expense-icon"><Icon size={16} /></span><div><strong>{expense.category}</strong><small>{expense.description || "No description"}{expense.vehicle && expense.vehicle !== "—" ? ` · ${expense.vehicle}` : ""}</small></div><span><strong>− {money(expense.amount)}</strong><small>{expense.date} · {expense.method} · {expense.createdBy}</small></span></article>; })}</div>{expenses.length > 12 && <button className="full-link" onClick={() => setShowAllExpenses((value) => !value)}>{showAllExpenses ? "Show recent expenses" : `View all ${expenses.length} expenses`} <ChevronRight size={15} /></button>}</section></div>
  </>;
}

function Notifications({ reminders, history, readKeys, onClose, markRead, openRental, openReservation }: { reminders: ReminderRow[]; history: NotificationHistoryItem[]; readKeys: string[]; onClose: () => void; markRead: (reminder: ReminderRow) => void; openRental: (rentalId: string) => void; openReservation: (reservationId: string) => void }) {
  void history;
  const newCount = reminders.filter((reminder) => !readKeys.includes(reminder.key)).length;
  const openItem = (reminder: ReminderRow) => {
    markRead(reminder);
    if (reminder.reservationId) openReservation(reminder.reservationId);
    else if (reminder.rentalId) openRental(reminder.rentalId);
    onClose();
  };
  return <div className="notifications-panel">
    <div className="notification-head"><div><strong>Notifications</strong><span>{newCount ? `${newCount} new` : reminders.length ? "All seen" : "No new"}</span></div><button onClick={onClose}><X size={16} /></button></div>
    <div className="notification-section-label"><span>Active notifications</span><b>{reminders.length}</b></div>
    {reminders.length ? reminders.map((reminder) => { const Icon = reminderIcon(reminder.type); const isRead = readKeys.includes(reminder.key); return <button className={isRead ? "notification-is-read" : "notification-is-new"} key={reminder.key} onClick={() => openItem(reminder)}><span className={`notice-icon ${reminder.tone === "urgent" ? "urgent" : reminder.type === "payment" ? "payment" : "warning"}`}><Icon size={15} /></span><div><strong>{reminder.title}</strong><ReminderCopy type={reminder.type} text={reminder.text} /><time className={`notification-status ${isRead ? "read" : "new"}`}>{isRead ? "READ" : "NEW"}</time></div></button>; }) : <div className="notification-empty-state">No active notifications right now.</div>}
    <div className="notification-footer" onClick={onClose}>Close notifications</div>
  </div>;
}

function MobileNav({ view, goTo, openNew }: { view: View; goTo: (view: View) => void; openNew: () => void }) {
  const items: { view: View; label: string; icon: LucideIcon }[] = [{ view: "dashboard", label: "Home", icon: LayoutDashboard }, { view: "rentals", label: "Rentals", icon: CalendarRange }, { view: "vehicles", label: "Vehicles", icon: CarFront }, { view: "customers", label: "Customers", icon: UsersRound }];
  return <nav className="bottom-nav" aria-label="Mobile navigation">{items.slice(0,2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}<button className="mobile-create" onClick={openNew} aria-label="New rental"><Plus size={23} /></button>{items.slice(2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}</nav>;
}

function MobileQuickCreate({ close, newRental, newBooking }: { close: () => void; newRental: () => void; newBooking: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return <div className="mobile-quick-create-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="mobile-quick-create-sheet" role="dialog" aria-modal="true" aria-label="Create new">
      <div className="mobile-quick-create-handle" />
      <header>
        <div><span className="eyebrow">QUICK CREATE</span><h2>What do you want to add?</h2><p>Choose an action to continue.</p></div>
        <button type="button" className="mobile-quick-create-close" onClick={close} aria-label="Close"><X size={19} /></button>
      </header>
      <div className="mobile-quick-create-actions">
        <button type="button" onClick={newRental}>
          <span className="quick-create-icon rental"><CarFront size={23} /></span>
          <span className="quick-create-copy"><strong>New rental</strong><small>Hand over a vehicle and start a rental now</small></span>
          <ChevronRight size={19} />
        </button>
        <button type="button" onClick={newBooking}>
          <span className="quick-create-icon booking"><CalendarDays size={23} /></span>
          <span className="quick-create-copy"><strong>New booking</strong><small>Reserve a vehicle for a future date and time</small></span>
          <ChevronRight size={19} />
        </button>
      </div>
    </section>
  </div>;
}

function MobileMenu({ view, goTo, close }: { view: View; goTo: (view: View) => void; close: () => void }) {
  const itemButton = (item: (typeof navItems)[number]) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={18} />{item.label}<ChevronRight size={16} /></button>; };
  return <div className="mobile-menu-overlay"><aside><div className="mobile-menu-head"><div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div><button onClick={close}><X size={20} /></button></div><nav><span className="mobile-menu-section-label">WORKSPACE</span>{navItems.slice(0, 8).map(itemButton)}<span className="mobile-menu-section-label insights">INSIGHTS</span>{navItems.slice(8).map(itemButton)}<button className="mobile-menu-logout-action" type="button" onClick={() => { close(); void mecardeeQuickLogout(); }}><svg className="mecardee-logout-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 3h5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-5"/></svg><span>Log out</span><ChevronRight size={16} /></button></nav></aside></div>;
}

function DialogShell({ title, subtitle, close, wide = false, children }: { title: string; subtitle: string; close: () => void; wide?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const keepFocusedFieldVisible = (event: React.FocusEvent<HTMLElement>) => {
    if (window.innerWidth > 720) return;
    const target = event.target as HTMLElement;
    window.setTimeout(() => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const rect = target.getBoundingClientRect();
      const topGuard = 88;
      const bottomGuard = viewportHeight - 20;
      if (rect.top < topGuard || rect.bottom > bottomGuard) {
        target.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }, 80);
  };
  return <div className="dialog-overlay"><section className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onFocusCapture={keepFocusedFieldVisible}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={close} aria-label="Close"><X size={19} /></button></header>{children}</section></div>;
}


function VehicleDialog({ guest = false, close, done }: { guest?: boolean; close: () => void; done: (message: string) => void }) {
  const documentTypes = ["Insurance", "Pollution / PUC", "Registration / RC", "Fitness Certificate", "Permit", "Road Tax"];
  const tyrePositions = [["front-left", "Front left"], ["front-right", "Front right"], ["rear-left", "Rear left"], ["rear-right", "Rear right"], ["spare", "Spare"]] as const;
  const [name, setName] = useState(""); const [make, setMake] = useState(""); const [registrationNumber, setRegistrationNumber] = useState("");
  const [guestOwnerName, setGuestOwnerName] = useState(""); const [guestOwnerPlace, setGuestOwnerPlace] = useState("");
  const [fuelType, setFuelType] = useState("Petrol"); const [transmission, setTransmission] = useState("Manual"); const [modelYear, setModelYear] = useState(new Date().getFullYear());
  const [dailyRate, setDailyRate] = useState(1500); const [odometerKm, setOdometerKm] = useState(0); const [allowedKmPerDay, setAllowedKmPerDay] = useState(100); const [extraKmRate, setExtraKmRate] = useState(12); const [mileageKmPerLitre, setMileageKmPerLitre] = useState(15); const [operationalStatus, setOperationalStatus] = useState("available");
  const [documents, setDocuments] = useState(() => documentTypes.map((documentType) => ({ documentType, documentNumber: "", expiryDate: "", notes: "" })));
  const [service, setService] = useState({ title: "Periodic service", description: "", dueDate: "", dueOdometerKm: "", amount: "" });
  const [tyres, setTyres] = useState(() => tyrePositions.map(([position]) => ({ position, brand: "", model: "", size: "", installedDate: "", installedOdometerKm: "", treadDepthMm: "", replacementDueDate: "", replacementDueOdometerKm: "", notes: "" })));
  const [imageFile, setImageFile] = useState<File | null>(null); const [imagePreview, setImagePreview] = useState<string | null>(null); const [processingImage, setProcessingImage] = useState(false);
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  async function chooseImage(file: File | null) {
    if (!file) return;
    setProcessingImage(true); setError(null);
    try {
      const compressed = await compressVehicleImage(file);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImageFile(compressed); setImagePreview(URL.createObjectURL(compressed));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare the selected image."); }
    finally { setProcessingImage(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !make.trim() || !registrationNumber.trim()) return setError("Vehicle name, make and registration number are required.");
    if (guest && (!guestOwnerName.trim() || !guestOwnerPlace.trim())) return setError("Car owner name and owner place are required for a Guest Car.");
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/vehicles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), make: make.trim(), registrationNumber: registrationNumber.trim(), fuelType, transmission, modelYear, dailyRate, odometerKm, allowedKmPerDay, extraKmRate, mileageKmPerLitre, status: operationalStatus, isGuest: guest, guestOwnerName: guest ? guestOwnerName.trim() : undefined, guestOwnerPlace: guest ? guestOwnerPlace.trim() : undefined }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; vehicle?: { id: string } }>(response);
      if (!response.ok || !payload.ok || !payload.vehicle?.id) throw new Error(payload.error ?? `Could not save ${guest ? "Guest Car" : "vehicle"}.`);
      const vehicleId = payload.vehicle.id;
      const tasks: Promise<unknown>[] = [];
      if (imageFile) { const formData = new FormData(); formData.append("file", imageFile); tasks.push(fetch(`/api/vehicles/${vehicleId}/image`, { method: "POST", body: formData }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not upload vehicle image."); })); }
      if (!guest) {
        for (const doc of documents) if (doc.documentNumber || doc.expiryDate || doc.notes) tasks.push(fetch(`/api/vehicles/${vehicleId}/documents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? `Could not save ${doc.documentType}.`); }));
        if (service.description || service.dueDate || service.dueOdometerKm || service.amount) tasks.push(fetch(`/api/vehicles/${vehicleId}/maintenance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(service) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not save maintenance details."); }));
        for (const tyre of tyres) if (tyre.brand || tyre.model || tyre.size || tyre.installedDate || tyre.installedOdometerKm || tyre.treadDepthMm || tyre.replacementDueDate || tyre.replacementDueOdometerKm || tyre.notes) tasks.push(fetch(`/api/vehicles/${vehicleId}/tyres`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tyre) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not save tyre details."); }));
      }
      await Promise.all(tasks);
      done(`${name.trim()} added to ${guest ? "Guest Cars" : "fleet"}`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : `Could not save ${guest ? "Guest Car" : "vehicle"}.`); }
    finally { setSaving(false); }
  }

  return <DialogShell title={guest ? "Add Guest Car" : "Add vehicle"} subtitle={guest ? "Basic vehicle details and photo · no maintenance tracking" : "Vehicle, documents, service, tyres and photo"} close={close} wide>
    <form className="simple-form" onSubmit={submit}>
      <section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>{guest ? "Guest Car details" : "Vehicle details"}</h3><p>{guest ? "Temporary/external vehicle information." : "Main fleet information."}</p></div></div><div className="field-grid">
        <label className="field"><span>Vehicle name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Maruti Swift" /></label><label className="field"><span>Make / manufacturer</span><input required value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti Suzuki" /></label><label className="field"><span>Registration number</span><input required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} placeholder="KL 35 AB 1234" /></label>{guest && <><label className="field"><span>Car owner name</span><input required value={guestOwnerName} onChange={(e) => setGuestOwnerName(e.target.value)} placeholder="Owner name" /></label><label className="field"><span>Owner place</span><input required value={guestOwnerPlace} onChange={(e) => setGuestOwnerPlace(e.target.value)} placeholder="City / place" /></label></>}<label className="field"><span>Model year</span><input required min="1980" max="2100" type="number" value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} /></label><label className="field"><span>Fuel type</span><select value={fuelType} onChange={(e) => setFuelType(e.target.value)}><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option><option>CNG</option></select></label><label className="field"><span>Transmission</span><select value={transmission} onChange={(e) => setTransmission(e.target.value)}><option>Manual</option><option>Automatic</option></select></label><label className="field"><span>Operational status</span><select value={operationalStatus} onChange={(e) => setOperationalStatus(e.target.value)}><option value="available">Active</option><option value="inactive">Inactive</option>{!guest && <option value="maintenance">Maintenance</option>}</select><small>{guest ? "Guest Cars can be Active or Inactive. Rental status is automatic." : "Bookings and on-rent status are controlled automatically."}</small></label><label className="field"><span>Daily rental rate (₹)</span><input required min="1" type="number" value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} /></label><label className="field"><span>Current odometer (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(odometerKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(e) => setOdometerKm(numberFromInput(e.target.value))} /></label><label className="field"><span>Allowed KM / day</span><input required min="1" type="number" value={allowedKmPerDay} onChange={(e) => setAllowedKmPerDay(Number(e.target.value))} /></label><label className="field"><span>Extra KM rate (₹)</span><input required min="0" step="0.01" type="number" value={extraKmRate} onChange={(e) => setExtraKmRate(Number(e.target.value))} /></label><label className="field"><span>Mileage (KM/L)</span><input required min="0.1" step="0.1" type="number" value={mileageKmPerLitre} onChange={(e) => setMileageKmPerLitre(Number(e.target.value))} /></label><label className="field"><span>Vehicle image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage} onChange={(e) => void chooseImage(e.target.files?.[0] ?? null)} /><small>{processingImage ? "Compressing image…" : "Automatically resized/compressed for fast mobile upload"}</small></label>{imagePreview && <div className="field"><span>Preview</span><img src={imagePreview} alt="Vehicle preview" style={{ width:"100%",height:120,objectFit:"cover",borderRadius:14,border:"1px solid #e5e7eb" }} /></div>}
      </div></section>

      {!guest && <><details><summary><strong>Documents</strong> — Insurance, pollution, RC, fitness, permit and tax</summary><div className="field-grid" style={{marginTop:12}}>{documents.map((doc,index)=><div key={doc.documentType} className="field" style={{border:"1px solid #e5e7eb",borderRadius:12,padding:10}}><strong>{doc.documentType}</strong><input placeholder="Document number" value={doc.documentNumber} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,documentNumber:e.target.value}:d))}/><input type="date" value={doc.expiryDate} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,expiryDate:e.target.value}:d))}/><input placeholder="Notes" value={doc.notes} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,notes:e.target.value}:d))}/></div>)}</div></details>
      <details><summary><strong>Maintenance / service</strong></summary><div className="field-grid" style={{marginTop:12}}><label className="field"><span>Service title</span><input value={service.title} onChange={(e)=>setService({...service,title:e.target.value})}/></label><label className="field"><span>Due date</span><input type="date" value={service.dueDate} onChange={(e)=>setService({...service,dueDate:e.target.value})}/></label><label className="field"><span>Due odometer</span><input type="number" value={service.dueOdometerKm} onChange={(e)=>setService({...service,dueOdometerKm:e.target.value})}/></label><label className="field"><span>Estimated amount</span><input type="number" value={service.amount} onChange={(e)=>setService({...service,amount:e.target.value})}/></label><label className="field"><span>Notes</span><input value={service.description} onChange={(e)=>setService({...service,description:e.target.value})}/></label></div></details>
      <details><summary><strong>Tyres</strong> — current tyre information</summary><div className="field-grid" style={{marginTop:12}}>{tyres.map((tyre,index)=>{const label=tyrePositions.find(([p])=>p===tyre.position)?.[1]??tyre.position;return <div key={tyre.position} className="field" style={{border:"1px solid #e5e7eb",borderRadius:12,padding:10}}><strong>{label}</strong><input placeholder="Brand" value={tyre.brand} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,brand:e.target.value}:t))}/><input placeholder="Model" value={tyre.model} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,model:e.target.value}:t))}/><input placeholder="Size e.g. 195/55 R16" value={tyre.size} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,size:e.target.value}:t))}/><input type="number" placeholder="Replace by KM" value={tyre.replacementDueOdometerKm} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,replacementDueOdometerKm:e.target.value}:t))}/></div>})}</div></details></>}
      {guest && <div className="guest-car-form-note"><ShieldCheck size={16} /><span><strong>Guest Car accounting stays separate.</strong><small>No maintenance, tyre or service management is created for this vehicle.</small></span></div>}
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || processingImage}><Check size={16}/>{saving ? "Saving…" : guest ? "Add Guest Car" : "Add vehicle"}</button></div>
    </form>
  </DialogShell>;
}

function CustomerEditDialog({ customer, close, done }: { customer: CustomerRow; close: () => void; done: (message: string) => void }) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [whatsappNumber, setWhatsappNumber] = useState(customer.whatsappNumber || customer.phone);
  const [drivingLicence, setDrivingLicence] = useState(customer.fullLicence || customer.licence || "");
  const [city, setCity] = useState(customer.city || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone, whatsappNumber, drivingLicence, city }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string } }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not update customer.");
      done(`${payload.customer?.name ?? name} updated`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update customer.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Edit customer" subtitle="Update customer details without changing rental history" close={close}>
    <form className="simple-form" onSubmit={submit}>
      <label className="field"><span>Customer name</span><input required value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span>Phone</span><input required inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <label className="field"><span>WhatsApp</span><input inputMode="tel" value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} /></label>
      <label className="field"><span>Driving licence (optional)</span><input value={drivingLicence} onChange={(event) => setDrivingLicence(event.target.value.toUpperCase())} /></label>
      <label className="field"><span>City / place</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
      <div className="customer-edit-note"><ShieldCheck size={15} /><span>Existing rentals, bookings, payments and history remain linked to this customer.</span></div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || !name.trim() || !phone.trim()}><Check size={16} />{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
  </DialogShell>;
}

function CustomerDialog({ customers, close, done }: { customers: CustomerRow[]; close: () => void; done: (message: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [drivingLicence, setDrivingLicence] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const phoneKey = customerPhoneKey(phone);
    const duplicateCustomer = phoneKey ? customers.find((customer) => customerPhoneKey(customer.phone) === phoneKey) : null;
    if (duplicateCustomer) {
      setError(`This phone number is already added for ${duplicateCustomer.name}. Please use the existing customer.`);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, whatsappNumber, drivingLicence, city }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(customerCreateError(payload.error));
      done(`${payload.customer.name} added to customers`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save customer.");
    } finally { setSaving(false); }
  }

  return <DialogShell title="Add customer" subtitle="Customer contact and licence details" close={close}>
    <form className="simple-form" onSubmit={submit}>
      <div className="field-grid">
        <label className="field"><span>Customer name</span><input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></label>
        <label className="field"><span>Phone number</span><input required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" /></label>
        <label className="field"><span>WhatsApp number</span><input inputMode="tel" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="Leave blank to use phone" /></label>
        <label className="field"><span>Driving licence number (optional)</span><input value={drivingLicence} onChange={(e) => setDrivingLicence(e.target.value.toUpperCase())} placeholder="Optional" /></label>
        <label className="field span-2"><span>City / place</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Optional" /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving}><UserRoundPlus size={16} />{saving ? "Saving…" : "Add customer"}</button></div>
    </form>
  </DialogShell>;
}

function NewBookingDialog({ vehicles, guestVehicles, customers, bookings, rentals, seed, close, done, showToast }: { vehicles: Vehicle[]; guestVehicles: Vehicle[]; customers: CustomerRow[]; bookings: BookingRecord[]; rentals: Rental[]; seed: { vehicleId: string; date: string } | null; close: () => void; done: (message: string) => void; showToast: (message: string) => void }) {
  const bookableVehicles = vehicles.filter((item) => !["inactive", "maintenance"].includes(item.statusKey));
  const initialVehicle = seed?.vehicleId ? (bookableVehicles.find((item) => item.id === seed.vehicleId) ?? null) : null;
  const [vehicleId, setVehicleId] = useState(initialVehicle?.id ?? "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startDate, setStartDate] = useState(seed?.date ?? dateInputValue(new Date()));
  const [startTime, setStartTime] = useState("10:00");
  const [daysInput, setDaysInput] = useState("1");
  const addDays = (base: string, count: number) => { const [y,m,d] = base.split("-").map(Number); const value = new Date(y,m-1,d); value.setDate(value.getDate() + Math.max(1, Math.trunc(count || 1))); return dateInputValue(value); };
  const [returnDate, setReturnDate] = useState(() => addDays(seed?.date ?? dateInputValue(new Date()), 1));
  const [returnTime, setReturnTime] = useState("10:00");
  const selectedVehicle = bookableVehicles.find((item) => item.id === vehicleId) ?? null;
  const [rate, setRate] = useState(initialVehicle?.rate ?? 0);
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerWhatsapp, setNewCustomerWhatsapp] = useState("");
  const [newCustomerLicence, setNewCustomerLicence] = useState("");
  const [newCustomerCity, setNewCustomerCity] = useState("");
  const [createdCustomer, setCreatedCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = Math.max(1, Number(daysInput) || 1);
  const requestedStartAt = useMemo(() => new Date(`${startDate}T${startTime}:00+05:30`), [startDate, startTime]);
  const requestedEndAt = useMemo(() => new Date(`${returnDate}T${returnTime}:00+05:30`), [returnDate, returnTime]);
  const requestedConflict = useMemo(() => selectedVehicle && requestedEndAt > requestedStartAt
    ? findVehiclePeriodConflict(selectedVehicle.id, requestedStartAt, requestedEndAt, bookings, rentals)
    : null, [selectedVehicle?.id, requestedStartAt.getTime(), requestedEndAt.getTime(), bookings, rentals]);
  const ownAlternatives = requestedConflict && selectedVehicle
    ? availableBookingVehicles(vehicles, requestedStartAt, requestedEndAt, bookings, rentals, selectedVehicle.id)
    : [];
  const guestAlternatives = requestedConflict
    ? availableBookingVehicles(guestVehicles, requestedStartAt, requestedEndAt, bookings, rentals)
    : [];
  const replacementChoices = [...ownAlternatives, ...guestAlternatives];
  const replacementVehicle = replacementChoices.find((item) => item.id === replacementVehicleId) ?? null;
  const assignedBookingVehicle = replacementVehicle ?? selectedVehicle;
  const conflictToastKey = useRef("");

  useEffect(() => {
    if (!requestedConflict) {
      conflictToastKey.current = "";
      if (replacementVehicleId) setReplacementVehicleId("");
      return;
    }
    if (replacementVehicleId && !replacementChoices.some((item) => item.id === replacementVehicleId)) setReplacementVehicleId("");
    const key = `${selectedVehicle?.id ?? ""}|${startDate}|${startTime}|${returnDate}|${returnTime}|${requestedConflict.type}|${requestedConflict.label}`;
    if (conflictToastKey.current !== key) {
      conflictToastKey.current = key;
      showToast(`${selectedVehicle?.name ?? "Vehicle"} has a schedule overlap. You can keep this booking and arrange a vehicle change before the collision, or choose a replacement now.`);
    }
  }, [requestedConflict?.type, requestedConflict?.label, replacementVehicleId, replacementChoices.map((item) => item.id).join("|"), returnDate, returnTime, selectedVehicle?.id, selectedVehicle?.name, showToast, startDate, startTime]);

  useEffect(() => {
    if (replacementVehicle) setRate(replacementVehicle.rate);
    else if (selectedVehicle) setRate(selectedVehicle.rate);
    else setRate(0);
  }, [selectedVehicle?.id, replacementVehicle?.id]);

  async function addCustomerHere() {
    setError(null);
    const phoneKey = customerPhoneKey(newCustomerPhone);
    const duplicateCustomer = phoneKey ? (customers.find((customer) => customerPhoneKey(customer.phone) === phoneKey) ?? (createdCustomer && customerPhoneKey(createdCustomer.phone) === phoneKey ? createdCustomer : null)) : null;
    if (duplicateCustomer) {
      setError(`This phone number is already added for ${duplicateCustomer.name}. Please select the existing customer.`);
      return;
    }
    setSavingCustomer(true);
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone, whatsappNumber: newCustomerWhatsapp, drivingLicence: newCustomerLicence, city: newCustomerCity }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string; phone: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(customerCreateError(payload.error));
      setCreatedCustomer(payload.customer); setCustomerPhone(payload.customer.phone); setShowCustomerForm(false); showToast(`${payload.customer.name} added and selected`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save customer."); } finally { setSavingCustomer(false); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerPhone) return setError("Select or add a customer first.");
    if (!selectedVehicle) return setError("Select the requested vehicle.");
    if (requestedEndAt <= requestedStartAt) return setError("Return date must be after the pickup date/time.");
    if (!assignedBookingVehicle) return setError("Select a booking vehicle.");
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        requestedVehicleRegistration: selectedVehicle.plate,
        vehicleRegistration: assignedBookingVehicle.plate,
        customerPhone,
        startAt: requestedStartAt.toISOString(),
        endAt: requestedEndAt.toISOString(),
        rentalDays: days,
        dailyRate: rate,
      }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; booking?: { bookingNumber: string; replacementBooked?: boolean; scheduleConflict?: boolean } }>(response);
      if (!response.ok || !payload.booking) throw new Error(payload.error ?? "Could not save booking.");
      const customer = customers.find((item) => item.phone === customerPhone)?.name ?? createdCustomer?.name ?? customerPhone;
      const replacementNote = assignedBookingVehicle.id !== selectedVehicle.id ? ` · ${assignedBookingVehicle.name}${assignedBookingVehicle.isGuest ? " (Guest Car)" : ""} reserved as replacement` : requestedConflict ? " · CHANGE REQUIRED before schedule collision" : "";
      done(`${selectedVehicle.name} booking created for ${customer} · ${payload.booking.bookingNumber}${replacementNote}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save booking."); } finally { setSaving(false); }
  }

  return <DialogShell title="Book a car" subtitle="Select the customer first, then choose the requested vehicle and booking period." close={close} wide>
    <form className="rental-form booking-form" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault(); }}>
      <div className="form-content">
        <section className="form-section"><div className="form-section-title"><span><UserRound size={17} /></span><div><h3>Customer & vehicle</h3><p>Choose the customer first. A vehicle is prefilled only when booking directly from that vehicle.</p></div></div><div className="field-grid">
          <label className="field"><span>Customer</span><select value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}><option value="">Select customer</option>{createdCustomer && !customers.some((item) => item.phone === createdCustomer.phone) && <option value={createdCustomer.phone}>{createdCustomer.name} — {createdCustomer.phone}</option>}{customers.map((item) => <option value={item.phone} key={item.id}>{item.name} — {item.phone}</option>)}</select></label>
          <button type="button" className="new-customer" onClick={() => setShowCustomerForm((value) => !value)}><UserRoundPlus size={16} />{showCustomerForm ? "Close" : "Add new customer"}</button>
          <label className="field span-2"><span>Requested vehicle</span><select value={vehicleId} disabled={!customerPhone && !initialVehicle} onChange={(e) => { setVehicleId(e.target.value); setReplacementVehicleId(""); const v = bookableVehicles.find((item) => item.id === e.target.value); setRate(v?.rate ?? 0); }}><option value="">Select vehicle</option>{bookableVehicles.map((item) => <option value={item.id} key={item.id}>{item.name} — {item.plate} · {item.status}</option>)}</select><small>{initialVehicle ? "Opened from this vehicle, so it was prefilled. Select the customer to continue." : customerPhone ? "Choose the vehicle the customer originally requested." : "Select the customer first to choose a vehicle."}</small></label>
        </div></section>
        {requestedConflict && selectedVehicle && <section className="replacement-conflict-panel soft-schedule-conflict"><div className="replacement-conflict-head"><AlertTriangle size={18} /><div><strong>Schedule overlap — vehicle change required</strong><p>{requestedConflict.type === "booking" ? "Booking" : "Rental"} {requestedConflict.label}{requestedConflict.customer ? ` for ${requestedConflict.customer}` : ""} overlaps this period. You may keep {selectedVehicle.name} on this booking. The vehicle only has to be physically available when the rental starts; arrange a Change Vehicle before the collision if needed.</p></div></div><div className="original-booking-context compact"><strong>Keep original booking: {selectedVehicle.name} — {days} Days</strong><span>The existing booking is protected. This new booking will be marked as needing a vehicle change on the overlapping calendar date.</span></div><label className="field"><span>Optional replacement now</span><select value={replacementVehicleId} onChange={(event) => setReplacementVehicleId(event.target.value)}><option value="">Continue with {selectedVehicle.name}</option>{ownAlternatives.length > 0 && <optgroup label="Our available vehicles">{ownAlternatives.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate}</option>)}</optgroup>}{guestAlternatives.length > 0 && <optgroup label="Guest Cars">{guestAlternatives.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate} · Guest Car</option>)}</optgroup>}</select><small>{replacementChoices.length ? "Optional: reserve a conflict-free replacement for the complete period now, or continue with the requested vehicle and arrange the change later." : "No complete-period replacement is free now. You can still keep the requested vehicle booking and arrange a change later."}</small></label></section>}
        {showCustomerForm && <section className="form-section"><div className="field-grid"><label className="field"><span>Name</span><input value={newCustomerName} onChange={(e)=>setNewCustomerName(e.target.value)} /></label><label className="field"><span>Phone</span><input inputMode="tel" value={newCustomerPhone} onChange={(e)=>setNewCustomerPhone(e.target.value)} /></label><label className="field"><span>WhatsApp</span><input inputMode="tel" value={newCustomerWhatsapp} onChange={(e)=>setNewCustomerWhatsapp(e.target.value)} /></label><label className="field"><span>Driving licence (optional)</span><input value={newCustomerLicence} onChange={(e)=>setNewCustomerLicence(e.target.value.toUpperCase())} /></label><label className="field span-2"><span>City / place</span><input value={newCustomerCity} onChange={(e)=>setNewCustomerCity(e.target.value)} /></label></div><div className="form-actions"><button type="button" onClick={() => setShowCustomerForm(false)}>Cancel</button><button type="button" className="primary-button" disabled={savingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()} onClick={() => void addCustomerHere()}>{savingCustomer ? "Saving…" : "Save customer"}</button></div></section>}
        <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Booking period</h3><p>The selected booking vehicle is reserved for this complete period.</p></div></div><div className="field-grid rental-schedule-grid"><label className="field"><span>Start date</span><input type="date" min={dateInputValue(new Date())} value={startDate} onChange={(e)=>{ const next=e.target.value; setStartDate(next); setReturnDate(addDays(next,days)); }} /></label><label className="field"><span>Start time</span><input type="time" value={startTime} onChange={(e)=>{ const next=e.target.value; setStartTime(next); setReturnTime((current)=>current===startTime?next:current); }} /></label><label className="field"><span>Rental days</span><input type="number" min="1" inputMode="numeric" value={daysInput} onChange={(e)=>{ const raw=e.target.value.replace(/\D/g,""); setDaysInput(raw); if(raw) setReturnDate(addDays(startDate,Number(raw))); }} /></label><label className="field"><span>Expected return</span><input type="date" value={returnDate} onChange={(e)=>{ const next=e.target.value; const [sy,sm,sd]=startDate.split("-").map(Number); const [ey,em,ed]=next.split("-").map(Number); const diff=Math.max(1,Math.round((Date.UTC(ey,em-1,ed)-Date.UTC(sy,sm-1,sd))/86_400_000)); setDaysInput(String(diff)); setReturnDate(next); }} /></label><label className="field"><span>Return time</span><input type="time" value={returnTime} onChange={(e)=>setReturnTime(e.target.value)} /></label><label className="field"><span>Daily rate (₹)</span><input type="number" min="0" value={blankZero(rate)} onChange={(e)=>setRate(numberFromInput(e.target.value))} /></label></div><div className="duration-note"><CalendarRange size={16} /><strong>{days} booked day{days===1?"":"s"}</strong><span>{money(days*rate)} estimated rental</span></div></section>
        
      </div>
      <footer className="rental-submit-footer">{error && <p className="form-error">{error}</p>}<div className="rental-submit-actions"><button type="submit" className="confirm-rental" disabled={saving || !selectedVehicle || !customerPhone}>{saving ? "Booking..." : requestedConflict && !replacementVehicle ? "Confirm with warning" : "Confirm booking"}<CalendarDays size={16} /></button><button type="button" className="save-draft" onClick={close}>Cancel</button></div></footer>
    </form>
  </DialogShell>;
}

function BookingDetailDialog({ reservation, canStart, close, edit, start, cancelled }: { reservation: Reservation; canStart: boolean; close: () => void; edit: () => void; start: () => void; cancelled: (message: string) => void }) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancelBooking() {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/bookings/${reservation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not cancel booking.");
      cancelled(`${reservation.bookingNumber} cancelled. The car is available for that period again.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not cancel booking."); } finally { setSaving(false); }
  }
  return <DialogShell title={reservation.bookingNumber} subtitle="Future booking · not yet handed over" close={close}>
    <div className="booking-detail-card"><img src={reservation.image} alt={`${reservation.vehicle} vehicle`} /><div><span className="fleet-status-badge booked"><i />Booked</span><h2>{reservation.vehicle}</h2><p>{reservation.plate}</p></div></div>
    <section className="detail-section"><div className="customer-detail-card"><span>{reservation.customer.split(" ").map((part)=>part[0]).join("")}</span><div><strong>{reservation.customer}</strong><small>{reservation.phone}</small></div></div></section>
    {reservation.replacementBooked && <div className="original-booking-context compact booking-original-context"><strong>Original requested vehicle: {reservation.requestedVehicle} — {reservation.requestedPlate}</strong><span>Reserved vehicle: {reservation.vehicle} — {reservation.plate}. The original request remains attached to this booking.</span></div>}
    <section className="detail-section"><div className="timeline"><div><i /><span><small>Booked from</small><strong>{reservation.start}</strong></span></div><b /><div><i /><span><small>Expected return</small><strong>{reservation.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Booked days</small><strong>{reservation.days}</strong></div><div><small>Daily rate</small><strong>{money(reservation.rate)}</strong></div><div><small>Estimated rent</small><strong>{money(reservation.amount)}</strong></div></div></section>
    {error && <p className="form-error">{error}</p>}
    {confirmCancel && <div className="booking-cancel-warning"><AlertTriangle size={18} /><div><strong>Cancel this booking?</strong><p>No rental/payment data will be deleted. The booking is marked Cancelled and the dates become available again.</p></div><button disabled={saving} onClick={() => void cancelBooking()}>{saving ? "Cancelling…" : "Yes, cancel"}</button><button disabled={saving} onClick={() => setConfirmCancel(false)}>Keep booking</button></div>}
    <footer className="detail-actions booking-detail-schedule-actions"><button className="booking-date-time-action" onClick={edit} disabled={saving}><CalendarRange size={16} />Change date & time</button><button className="return-button" onClick={start} disabled={!canStart} title={canStart ? "Start this rental" : "Change the booking time if needed while waiting for pickup"}><CarFront size={16} />{canStart ? "Start rental" : "Waiting for availability"}</button><button className="danger-action" onClick={() => setConfirmCancel(true)} disabled={confirmCancel}><X size={16} />Cancel booking</button></footer>
  </DialogShell>;
}


function BookingHistoryDialog({ booking, close, sendWhatsApp }: { booking: BookingRecord; close: () => void; sendWhatsApp: () => void }) {
  const label = booking.status === "cancelled" ? "Cancelled" : booking.status === "completed" ? "Completed" : booking.status === "rented" ? "Active" : "Booking";
  return <DialogShell title={booking.bookingNumber} subtitle={`${label} booking record`} close={close}>
    <div className="booking-detail-card"><img src={booking.image} alt={`${booking.vehicle} vehicle`} /><div><span className={`fleet-status-badge ${booking.status === "cancelled" ? "maintenance" : booking.status === "completed" ? "available" : booking.status === "rented" ? "rented" : "booked"}`}><i />{label}</span><h2>{booking.vehicle}</h2><p>{booking.plate}</p></div></div>
    <section className="detail-section"><div className="customer-detail-card"><span>{booking.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{booking.customer}</strong><small>{booking.phone}</small></div></div></section>
    {booking.replacementBooked && <div className="original-booking-context compact booking-original-context"><strong>Original requested vehicle: {booking.requestedVehicle} — {booking.requestedPlate}</strong><span>Reserved vehicle: {booking.vehicle} — {booking.plate}. The original request remains attached to this booking.</span></div>}
    <section className="detail-section"><div className="timeline"><div><i /><span><small>Pickup</small><strong>{booking.start}</strong></span></div><b /><div><i /><span><small>Return</small><strong>{booking.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Days</small><strong>{booking.days}</strong></div><div><small>Daily rate</small><strong>{money(booking.rate)}</strong></div><div><small>Booking amount</small><strong>{money(booking.amount)}</strong></div><div><small>Advance</small><strong>{money(booking.advancePaid)}</strong></div><div><small>Total paid</small><strong>{money(booking.paid)}</strong></div><div><small>Balance</small><strong>{money(booking.balance)}</strong></div></div></section>
    <footer className="detail-actions"><button className="return-button" onClick={sendWhatsApp}><MessageCircle size={16} />WhatsApp</button><button onClick={close}>Close</button></footer>
  </DialogShell>;
}

function BookingEditDialog({ booking, vehicles, guestVehicles, bookings, rentals, close, done }: { booking: BookingRecord; vehicles: Vehicle[]; guestVehicles: Vehicle[]; bookings: BookingRecord[]; rentals: Rental[]; close: () => void; done: (message: string) => void }) {
  const startParts = indiaDateTimeParts(booking.startAt);
  const endParts = indiaDateTimeParts(booking.endAt);
  const [vehicleId, setVehicleId] = useState(booking.vehicleId);
  const [startDate, setStartDate] = useState(startParts.date);
  const [startTime, setStartTime] = useState(startParts.time);
  const [returnDate, setReturnDate] = useState(endParts.date);
  const [returnTime, setReturnTime] = useState(endParts.time);
  const [days, setDays] = useState(booking.days);
  const [rate, setRate] = useState(booking.rate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allVehicles = [...vehicles, ...guestVehicles];
  const selectedVehicle = allVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  const startAt = useMemo(() => new Date(`${startDate}T${startTime}:00+05:30`), [startDate, startTime]);
  const endAt = useMemo(() => new Date(`${returnDate}T${returnTime}:00+05:30`), [returnDate, returnTime]);
  const selectedConflict = useMemo(() => selectedVehicle && endAt > startAt
    ? findVehiclePeriodConflict(selectedVehicle.id, startAt, endAt, bookings, rentals, booking.id)
    : null, [selectedVehicle?.id, startAt.getTime(), endAt.getTime(), bookings, rentals, booking.id]);
  const freeOwn = availableBookingVehicles(vehicles, startAt, endAt, bookings, rentals, undefined, booking.id);
  const freeGuest = availableBookingVehicles(guestVehicles, startAt, endAt, bookings, rentals, undefined, booking.id);
  const optionIds = new Set([vehicleId, ...freeOwn.map((item) => item.id), ...freeGuest.map((item) => item.id)]);
  const ownOptions = vehicles.filter((item) => optionIds.has(item.id));
  const guestOptions = guestVehicles.filter((item) => optionIds.has(item.id));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVehicle) return setError("Select a vehicle.");
    if (endAt <= startAt) return setError("Return date must be after the pickup date/time.");
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "edit", vehicleId: selectedVehicle.id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), rentalDays: days, dailyRate: rate }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not update booking.");
      done(`${booking.bookingNumber} updated${selectedVehicle.id !== booking.vehicleId ? ` · vehicle changed to ${selectedVehicle.name}${selectedVehicle.isGuest ? " (Guest Car)" : ""}` : ""}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update booking."); } finally { setSaving(false); }
  }

  return <DialogShell title="Edit booking" subtitle={`${booking.bookingNumber} · ${booking.customer}`} close={close}>
    <form className="simple-form booking-edit-form" onSubmit={submit}>
      <div className="original-booking-context compact"><strong>Original requested vehicle: {booking.requestedVehicle} — {booking.requestedPlate}</strong><span>Changing the reserved vehicle here does not remove the original booking context.</span></div>
      <label className="field"><span>Reserved vehicle</span><select required value={vehicleId} onChange={(event) => { const nextId = event.target.value; setVehicleId(nextId); const nextVehicle = allVehicles.find((item) => item.id === nextId); if (nextVehicle) setRate(nextVehicle.rate); }}><optgroup label="Our available vehicles">{ownOptions.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate}{item.id === booking.requestedVehicleId ? " · Original request" : ""}</option>)}</optgroup>{guestOptions.length > 0 && <optgroup label="Guest Cars">{guestOptions.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate} · Guest Car</option>)}</optgroup>}</select><small>You can change the vehicle while this booking is still active. Conflict-free alternatives are offered. The current reserved vehicle may still be saved with a schedule warning.</small></label>
      <div className="field-grid">
        <label className="field"><span>Pickup date</span><input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="field"><span>Pickup time</span><input type="time" required value={startTime} onChange={(event) => { const nextTime = event.target.value; setStartTime(nextTime); setReturnTime(nextTime); }} /><small>Return time follows the pickup time automatically.</small></label>
        <label className="field"><span>Return date</span><input type="date" required value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label>
        <label className="field"><span>Return time</span><input type="time" required value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label>
        <label className="field"><span>Rental days</span><input type="number" min="1" required value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))} /></label>
        <label className="field"><span>Daily rate (₹)</span><input type="number" min="0" required value={blankZero(rate)} onChange={(event) => setRate(numberFromInput(event.target.value))} /></label>
      </div>
      <div className="duration-note"><CalendarRange size={16} /><strong>{days} day{days === 1 ? "" : "s"}</strong><span>{money(days * rate)} estimated rental</span></div>
      {selectedConflict && <p className="form-error booking-conflict-inline"><strong>Schedule overlap.</strong> {selectedVehicle?.name} conflicts with {selectedConflict.type} {selectedConflict.label}{selectedConflict.customer ? ` for ${selectedConflict.customer}` : ""}. You can save this booking and arrange a Change Vehicle before the collision.</p>}
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving || !selectedVehicle}><Check size={16} />{saving ? "Saving…" : "Save booking"}</button></div>
    </form>
  </DialogShell>;
}

function StartBookingDialog({ reservation, vehicle, vehicles, guestVehicles, bookings, rentals, close, done }: { reservation: Reservation; vehicle: Vehicle | null; vehicles: Vehicle[]; guestVehicles: Vehicle[]; bookings: BookingRecord[]; rentals: Rental[]; close: () => void; done: (message: string) => void }) {
  const pickupEndAt = new Date(new Date(reservation.startAt).getTime() + 1);
  const requestedConflict = vehicle ? findVehiclePeriodConflict(vehicle.id, reservation.startAt, pickupEndAt, bookings, rentals, reservation.id) : null;
  const futureScheduleConflict = vehicle ? findVehiclePeriodConflict(vehicle.id, reservation.startAt, reservation.endAt, bookings, rentals, reservation.id) : null;
  const originalOperationallyBlocked = !vehicle || ["inactive", "maintenance"].includes(vehicle.statusKey);
  const needsReplacement = Boolean(requestedConflict) || originalOperationallyBlocked;
  const ownReplacements = availableReplacementVehicles(vehicles, reservation.startAt, reservation.endAt, bookings, rentals, vehicle?.id, reservation.id);
  const guestReplacements = availableReplacementVehicles(guestVehicles, reservation.startAt, reservation.endAt, bookings, rentals, undefined, reservation.id);
  const replacementChoices = [...ownReplacements, ...guestReplacements];
  // MECARDEE_BOOKED_VEHICLE_START_GUARD_V8_9_46
  // Never silently pick the first replacement. If the booked car is free at
  // pickup, that exact car MUST start the rental. If it is not free, staff
  // must explicitly choose the replacement.
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const assignedVehicle = needsReplacement ? (replacementChoices.find((item) => item.id === replacementVehicleId) ?? null) : vehicle;
  const [startingKilometer, setStartingKilometer] = useState(assignedVehicle?.odometerKm ?? vehicle?.odometerKm ?? 0);
  const [startingFuelRangeKm, setStartingFuelRangeKm] = useState(100);
  const [rate, setRate] = useState(reservation.rate);
  const [advance, setAdvance] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedHandover, setStartedHandover] = useState<{ vehicle: string; plate: string; startingKilometer: number; startingFuelRangeKm: number; expectedKm: number; allowedKmPerDay: number; statusMessage: string } | null>(null);

  useEffect(() => {
    if (!needsReplacement) { if (replacementVehicleId) setReplacementVehicleId(""); return; }
    if (replacementVehicleId && !replacementChoices.some((item) => item.id === replacementVehicleId)) setReplacementVehicleId("");
  }, [needsReplacement, replacementVehicleId, replacementChoices.map((item) => item.id).join("|")]);

  useEffect(() => {
    if (assignedVehicle) setStartingKilometer(assignedVehicle.odometerKm);
  }, [assignedVehicle?.id]);

  const expectedKm = assignedVehicle ? calculateExpectedReturnKilometer(startingKilometer, reservation.days, assignedVehicle.allowedKmPerDay) : startingKilometer;
  const total = Math.max(0, reservation.days * rate - discount);

  function finishStartedRental() {
    if (!startedHandover) return;
    done(startedHandover.statusMessage);
  }

  function sendRentalStartedWhatsApp() {
    if (!startedHandover) return;
    const digits = (reservation.whatsappNumber || reservation.phone).replace(/\D/g, "");
    const phone =
      digits.length === 10
        ? `91${digits}`
        : digits.startsWith("0") && digits.length === 11
          ? `91${digits.slice(1)}`
          : digits;

    const text =
      `Mecardee Rental - Rental started\n\n` +
      `Hello ${reservation.customer},\n` +
      `Your vehicle rental has been started.\n\n` +
      `Vehicle: ${startedHandover.vehicle} (${startedHandover.plate})\n` +
      `Booking: ${reservation.bookingNumber}\n` +
      `Pickup: ${reservation.start}\n` +
      `Expected return: ${reservation.returnDate}\n` +
      `Rental days: ${reservation.days}\n` +
      `Starting KM: ${startedHandover.startingKilometer.toLocaleString("en-IN")} km\n` +
      `Starting fuel range: ${startedHandover.startingFuelRangeKm.toLocaleString("en-IN")} km\n` +
      `Allowed KM/day: ${startedHandover.allowedKmPerDay.toLocaleString("en-IN")} km\n` +
      `Expected return KM: ${startedHandover.expectedKm.toLocaleString("en-IN")} km\n\n` +
      `Please keep these vehicle handover details for reference.`;

    // This dialog is a top-level component, while the app's existing
    // openWhatsAppSafely helper lives inside the main page component. Use the
    // same safe web-link behaviour locally instead of referencing that
    // out-of-scope helper.
    const encodedText = encodeURIComponent(text);
    const webUrl = `https://wa.me/${phone}?text=${encodedText}`;
    const isIOS =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      window.location.href = webUrl;
      return;
    }
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      if (!assignedVehicle) throw new Error("No vehicle is available to start this booking.");
      const response = await fetch(`/api/bookings/${reservation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", replacementVehicleId: needsReplacement && replacementVehicleId ? replacementVehicleId : undefined, startingKilometer, startingFuelRangeKm, dailyRate: rate, securityDeposit: deposit, advancePaid: advance, bookingDiscount: discount, paymentMethod, receivedBy: CURRENT_USER_NAME }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not start rental.");
      const statusMessage = `${reservation.bookingNumber} started as an active rental for ${reservation.customer}${assignedVehicle.id !== reservation.vehicleId ? ` using ${assignedVehicle.name} as replacement` : ""}`;
      setStartedHandover({ vehicle: assignedVehicle.name, plate: assignedVehicle.plate, startingKilometer, startingFuelRangeKm, expectedKm, allowedKmPerDay: assignedVehicle.allowedKmPerDay, statusMessage });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start rental."); } finally { setSaving(false); }
  }

  return <DialogShell title={startedHandover ? "Rental started" : "Start booked rental"} subtitle={`${reservation.vehicle} · ${reservation.customer}`} close={startedHandover ? finishStartedRental : close} wide>
    {startedHandover ? <div className="rental-started-whatsapp-success"><div className="rental-started-success-icon"><CheckCircle2 size={25} /></div><div className="rental-started-success-copy"><h3>Rental confirmed</h3><p>{startedHandover.vehicle} · {startedHandover.plate} is now on rent. Send the handover details to {reservation.customer} if required.</p></div><div className="rental-started-handover-grid"><span><small>Starting KM</small><strong>{startedHandover.startingKilometer.toLocaleString("en-IN")} km</strong></span><span><small>Fuel range</small><strong>{startedHandover.startingFuelRangeKm.toLocaleString("en-IN")} km</strong></span><span><small>Allowed / day</small><strong>{startedHandover.allowedKmPerDay.toLocaleString("en-IN")} km</strong></span><span><small>Expected return KM</small><strong>{startedHandover.expectedKm.toLocaleString("en-IN")} km</strong></span></div><div className="rental-started-success-actions"><button type="button" className="rental-started-whatsapp" onClick={sendRentalStartedWhatsApp}><MessageCircle size={19} />WhatsApp handover</button><button type="button" className="primary-button" onClick={finishStartedRental}><Check size={17} />Done</button></div></div> : <form className="rental-form" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault(); }}><div className="form-content">
      <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Booked schedule</h3><p>The reservation becomes an active rental only after this confirmation.</p></div></div><div className="timeline"><div><i /><span><small>Start</small><strong>{reservation.start}</strong></span></div><b /><div><i /><span><small>Return</small><strong>{reservation.returnDate}</strong></span></div></div></section>
      <section className={`booking-start-vehicle-lock ${needsReplacement ? "replacement-needed" : "booked-vehicle-ready"}`}><CarFront size={18} /><div><small>{needsReplacement ? "Booked vehicle unavailable at pickup" : "Starting vehicle locked to booking"}</small><strong>{needsReplacement ? "Choose a replacement below" : `${reservation.vehicle} — ${reservation.plate}`}</strong><span>{needsReplacement ? "No replacement is selected automatically. Choose the actual vehicle you will hand over." : "This rental will start with the exact vehicle reserved on this booking. A later schedule collision does not change the starting vehicle."}</span></div></section>
      {!needsReplacement && futureScheduleConflict && <section className="schedule-change-warning"><AlertTriangle size={18} /><div><strong>Start allowed — future vehicle change required</strong><p>{reservation.vehicle} is free at pickup, so this rental can start normally. {futureScheduleConflict.type === "booking" ? "Booking" : "Rental"} {futureScheduleConflict.label}{futureScheduleConflict.customer ? ` for ${futureScheduleConflict.customer}` : ""} overlaps later in this rental period. Use Change Vehicle before that collision if the customer still has this car.</p></div></section>}
      {needsReplacement && <section className="replacement-conflict-panel"><div className="replacement-conflict-head"><AlertTriangle size={18} /><div><strong>Original vehicle unavailable</strong><p>{requestedConflict ? `${reservation.vehicle} conflicts with ${requestedConflict.type} ${requestedConflict.label}${requestedConflict.customer ? ` (${requestedConflict.customer})` : ""}.` : `${reservation.vehicle} is not currently operational.`} Choose another own vehicle or a Guest Car to start this same booking.</p></div></div><div className="original-booking-context compact"><strong>Original Booking: {reservation.requestedVehicle} — {reservation.days} Days</strong><span>The original requested vehicle remains attached to this rental. The selected vehicle is only the current replacement.</span></div><label className="field"><span>Replacement vehicle</span><select required value={replacementVehicleId} onChange={(event) => setReplacementVehicleId(event.target.value)}><option value="">Select replacement</option>{ownReplacements.length > 0 && <optgroup label="Our available vehicles">{ownReplacements.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate}</option>)}</optgroup>}{guestReplacements.length > 0 && <optgroup label="Guest Cars">{guestReplacements.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate} · Guest Car</option>)}</optgroup>}</select><small>{replacementChoices.length ? "Own vehicles are shown first, followed by Guest Cars." : "No replacement vehicle is available at the pickup time."}</small></label></section>}
      <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Vehicle handover</h3><p>{assignedVehicle ? `Record the actual odometer and fuel range for ${assignedVehicle.name}${assignedVehicle.isGuest ? " (Guest Car)" : ""}.` : "Select an available replacement vehicle first."}</p></div></div><div className="field-grid three"><label className="field"><span>Starting kilometer</span><input type="number" min="0" value={blankZero(startingKilometer)} onChange={(e)=>setStartingKilometer(numberFromInput(e.target.value))} /></label><label className="field"><span>Starting fuel range (KM)</span><input type="number" min="0" value={blankZero(startingFuelRangeKm)} onChange={(e)=>setStartingFuelRangeKm(numberFromInput(e.target.value))} /></label><label className="field"><span>Expected return KM</span><input readOnly value={`${expectedKm.toLocaleString("en-IN")} km`} /></label></div></section>
      <section className="form-section"><div className="form-section-title"><span><WalletCards size={17} /></span><div><h3>Payment details</h3><p>Confirm the booked rate and record anything received at handover.</p></div></div><div className="field-grid three"><label className="field"><span>Original booking daily rate (₹)</span><input type="number" min="0" value={blankZero(rate)} onChange={(e)=>setRate(numberFromInput(e.target.value))} /></label><label className="field"><span>Security deposit (₹)</span><input type="number" min="0" value={blankZero(deposit)} onChange={(e)=>setDeposit(numberFromInput(e.target.value))} /></label><label className="field"><span>Advance paid (₹)</span><input type="number" min="0" max={total} value={blankZero(advance)} onChange={(e)=>setAdvance(numberFromInput(e.target.value))} /></label><label className="field"><span>Discount (₹)</span><input type="number" min="0" max={reservation.days*rate} value={blankZero(discount)} onChange={(e)=>setDiscount(numberFromInput(e.target.value))} /></label><label className="field"><span>Payment method</span><select value={paymentMethod} onChange={(e)=>setPaymentMethod(e.target.value)}><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Other</option></select></label><label className="field"><span>Original booking total</span><input readOnly value={money(total)} /></label></div>{needsReplacement && assignedVehicle && <div className="replacement-rate-note"><CarFront size={15} /><span>The replacement segment uses {assignedVehicle.name}&apos;s configured rate of {money(assignedVehicle.rate)}/day in the final vehicle-wise settlement.</span></div>}</section>
    </div><footer className="rental-submit-footer">{error && <p className="form-error">{error}</p>}<div className="rental-submit-actions"><button className="confirm-rental" type="submit" disabled={saving || !assignedVehicle}>{saving ? "Starting…" : "Start rental"}<ArrowRight size={16} /></button><button className="save-draft" type="button" onClick={close}>Back</button></div></footer></form>}
  </DialogShell>;
}

function NewRentalDialog({ vehicles, guestVehicles, bookings, rentals, customers, seedVehicleId, close, done, showToast }: { vehicles: Vehicle[]; guestVehicles: Vehicle[]; bookings: BookingRecord[]; rentals: Rental[]; customers: CustomerRow[]; seedVehicleId: string | null; close: () => void; done: (message: string, plate?: string) => void; showToast: (message: string) => void }) {
  const selectableOriginalVehicles = vehicles.filter((item) => !["inactive", "maintenance"].includes(item.statusKey));
  const initialVehicle = seedVehicleId ? (selectableOriginalVehicles.find((item) => item.id === seedVehicleId) ?? null) : null;
  const [vehicle, setVehicle] = useState(initialVehicle ? `${initialVehicle.name} — ${initialVehicle.plate}` : "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date()));
  const [returnDate, setReturnDate] = useState(() => dateInputValue(new Date(Date.now() + 1 * 86_400_000)));
  const [rentalDaysInput, setRentalDaysInput] = useState("1");
  const [startTime, setStartTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [rate, setRate] = useState(initialVehicle?.rate ?? 0);
  const [advance, setAdvance] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [startingKilometer, setStartingKilometer] = useState(initialVehicle?.odometerKm ?? 0);
  const [startingFuelRangeKm, setStartingFuelRangeKm] = useState(100);
  const [replacementVehicleId, setReplacementVehicleId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerWhatsapp, setNewCustomerWhatsapp] = useState("");
  const [newCustomerLicence, setNewCustomerLicence] = useState("");
  const [newCustomerCity, setNewCustomerCity] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MECARDEE_RENTAL_DAYS_AUTO_DATE_V8_9_1
  const rentalReturnDateFromDays = (baseDate: string, count: number) => {
    const [year, month, day] = baseDate.split("-").map(Number);
    const next = new Date(year, month - 1, day);
    next.setDate(next.getDate() + Math.max(1, Math.trunc(count || 1)));
    return dateInputValue(next);
  };

  const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(startDate).getTime()) / 86_400_000));
  const rentalAmount = days * rate;
  const total = Math.max(0, rentalAmount - discount);
  const selectedVehicle = selectableOriginalVehicles.find((item) => vehicle.includes(item.plate)) ?? null;
  const selectedCustomer = customers.find((item) => item.phone === customerPhone) ?? (createdCustomer?.phone === customerPhone ? { name: createdCustomer.name } : null);
  const requestedStartAt = new Date(`${startDate}T${startTime}:00+05:30`);
  const requestedEndAt = new Date(`${returnDate}T${returnTime}:00+05:30`);
  const requestedConflict = selectedVehicle ? findVehiclePeriodConflict(selectedVehicle.id, requestedStartAt, requestedEndAt, bookings, rentals) : null;
  const originalUnavailable = Boolean(selectedVehicle && ["inactive", "maintenance"].includes(selectedVehicle.statusKey));
  const needsReplacement = Boolean(requestedConflict) || originalUnavailable;
  const ownReplacements = selectedVehicle ? availableReplacementVehicles(vehicles, requestedStartAt, requestedEndAt, bookings, rentals, selectedVehicle.id) : [];
  const guestReplacements = availableReplacementVehicles(guestVehicles, requestedStartAt, requestedEndAt, bookings, rentals);
  const replacementChoices = [...ownReplacements, ...guestReplacements];
  const replacementVehicle = replacementChoices.find((item) => item.id === replacementVehicleId) ?? null;
  const assignedVehicle = needsReplacement ? replacementVehicle : selectedVehicle;

  useEffect(() => {
    if (!needsReplacement) { if (replacementVehicleId) setReplacementVehicleId(""); return; }
    if (!replacementChoices.some((item) => item.id === replacementVehicleId)) setReplacementVehicleId(replacementChoices[0]?.id ?? "");
  }, [needsReplacement, replacementVehicleId, replacementChoices.map((item) => item.id).join("|")]);

  useEffect(() => {
    if (assignedVehicle) setStartingKilometer(assignedVehicle.odometerKm);
  }, [assignedVehicle?.id]);

  const expectedReturnKilometer = assignedVehicle
    ? calculateExpectedReturnKilometer(startingKilometer, days, assignedVehicle.allowedKmPerDay)
    : startingKilometer;

  async function saveRental(mode: "rented" | "draft") {
    if (!selectedVehicle) return setError("Add an own vehicle before creating a rental.");
    if (!customerPhone) return setError("Add or select a customer before creating a rental.");
    if (mode === "rented" && needsReplacement && !replacementVehicle) return setError("The requested vehicle has a conflict. Select an available replacement vehicle or Guest Car to continue.");
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleRegistration: selectedVehicle.plate,
          replacementVehicleId: mode === "rented" && needsReplacement ? replacementVehicle?.id : undefined,
          customerPhone,
          startAt: requestedStartAt.toISOString(),
          endAt: requestedEndAt.toISOString(),
          rentalDays: days,
          dailyRate: rate,
          securityDeposit: deposit,
          advancePaid: advance,
          bookingDiscount: discount,
          startingKilometer,
          startingFuelRangeKm,
          paymentMethod,
          receivedBy: CURRENT_USER_NAME,
          mode,
        }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; conflict?: boolean; rental?: { bookingNumber: string; mode?: string; replacementUsed?: boolean } }>(response);
      if (!response.ok || !payload.rental) throw new Error(payload.error ?? "Could not save the rental.");
      const action = mode === "draft" ? "draft saved" : "created";
      const replacementNote = mode === "rented" && assignedVehicle && assignedVehicle.id !== selectedVehicle.id ? ` · ${assignedVehicle.name}${assignedVehicle.isGuest ? " (Guest Car)" : ""} assigned as replacement` : "";
      done(`${selectedVehicle.name} rental ${payload.rental.bookingNumber} ${action} for ${selectedCustomer?.name ?? customerPhone}${replacementNote}`, selectedVehicle.plate);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the rental.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveRental("rented");
  }

  async function addCustomerHere() {
    setError(null);
    const phoneKey = customerPhoneKey(newCustomerPhone);
    const duplicateCustomer = phoneKey ? (customers.find((customer) => customerPhoneKey(customer.phone) === phoneKey) ?? (createdCustomer && customerPhoneKey(createdCustomer.phone) === phoneKey ? createdCustomer : null)) : null;
    if (duplicateCustomer) {
      setError(`This phone number is already added for ${duplicateCustomer.name}. Please select the existing customer.`);
      return;
    }
    setSavingCustomer(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone, whatsappNumber: newCustomerWhatsapp, drivingLicence: newCustomerLicence, city: newCustomerCity }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string; phone: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(customerCreateError(payload.error));
      setCreatedCustomer(payload.customer);
      setCustomerPhone(payload.customer.phone);
      setShowCustomerForm(false);
      showToast(`${payload.customer.name} added and selected`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save customer.");
    } finally { setSavingCustomer(false); }
  }

  return <DialogShell title="Create a new rental" subtitle="Customer → Vehicle → Rental details" close={close} wide>
    <div className="stepper"><span className="done"><i><Check size={13} /></i>Customer</span><b /><span className="active"><i>2</i>Vehicle & dates</span><b /><span><i>3</i>Handover</span></div>
    <form className="rental-form" onSubmit={submit} onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") event.preventDefault(); }}>
      <div className="form-content"><section className="form-section"><div className="form-section-title"><span><UserRound size={17} /></span><div><h3>Customer and vehicle</h3><p>Select the customer first. A vehicle is prefilled only when you started directly from that vehicle.</p></div></div><div className="field-grid"><label className="field"><span>Customer</span><select value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)}><option value="">Select customer</option>{createdCustomer && !customers.some((item) => item.phone === createdCustomer.phone) && <option value={createdCustomer.phone}>{createdCustomer.name}</option>}{customers.map((item) => <option key={item.id} value={item.phone}>{item.name}</option>)}</select></label><button type="button" className="new-customer" onClick={() => setShowCustomerForm((open) => !open)}><UserRoundPlus size={16} />{showCustomerForm ? "Close customer form" : "Add new customer"}</button><label className="field span-2"><span>Original requested vehicle</span><select value={vehicle} onChange={(event) => { const next = selectableOriginalVehicles.find((item) => event.target.value.includes(item.plate)); setVehicle(event.target.value); setReplacementVehicleId(""); setRate(next?.rate ?? 0); }} disabled={(!customerPhone && !initialVehicle) || !selectableOriginalVehicles.length}><option value="">Select vehicle</option>{selectableOriginalVehicles.map((item) => <option key={item.id}>{item.name} — {item.plate}</option>)}</select><small>{initialVehicle ? "Opened from this vehicle, so it was prefilled. Select the customer to continue." : customerPhone ? "Choose the vehicle the customer originally requested." : "Select the customer first to choose a vehicle."}</small></label></div></section>
        {showCustomerForm && <section className="form-section"><div className="form-section-title"><span><UserRoundPlus size={17} /></span><div><h3>Add new customer</h3><p>Save once and the customer is selected for this rental.</p></div></div><div className="simple-form"><div className="field-grid"><label className="field"><span>Customer name</span><input required value={newCustomerName} onChange={(e)=>setNewCustomerName(e.target.value)} /></label><label className="field"><span>Phone</span><input required inputMode="tel" value={newCustomerPhone} onChange={(e)=>setNewCustomerPhone(e.target.value)} /></label><label className="field"><span>WhatsApp</span><input inputMode="tel" value={newCustomerWhatsapp} onChange={(e)=>setNewCustomerWhatsapp(e.target.value)} placeholder="Leave blank to use phone" /></label><label className="field"><span>Driving licence (optional)</span><input value={newCustomerLicence} onChange={(e)=>setNewCustomerLicence(e.target.value.toUpperCase())} placeholder="Optional" /></label><label className="field span-2"><span>City / place</span><input value={newCustomerCity} onChange={(e)=>setNewCustomerCity(e.target.value)} /></label></div><div className="form-actions"><button type="button" onClick={()=>setShowCustomerForm(false)}>Cancel</button><button type="button" className="primary-button" disabled={savingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()} onClick={() => void addCustomerHere()}>{savingCustomer?"Saving…":"Save customer"}</button></div></div></section>}
        <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Enter rental days or choose the return date manually.</p></div></div><div className="field-grid rental-schedule-grid"><label className="field"><span>Start date</span><input required type="date" value={startDate} onChange={(event) => { const next = event.target.value; const count = Math.max(1, Number(rentalDaysInput) || days || 1); setStartDate(next); setReturnDate(rentalReturnDateFromDays(next, count)); }} /></label><label className="field"><span>Start time</span><input required type="time" value={startTime} onChange={(event) => { const next = event.target.value; setReturnTime((current) => current === startTime ? next : current); setStartTime(next); }} /></label><label className="field rental-days-field"><span>Rental days</span><input min="1" step="1" type="number" inputMode="numeric" placeholder="1" value={rentalDaysInput} onKeyDown={numericKeyOnly} onChange={(event) => { const raw = event.target.value.replace(/\D/g, ""); setRentalDaysInput(raw); if (raw) setReturnDate(rentalReturnDateFromDays(startDate, Number(raw))); }} onBlur={() => { if (!rentalDaysInput) setRentalDaysInput(String(days)); }} /></label><label className="field"><span>Expected return</span><input required type="date" value={returnDate} onChange={(event) => { const next = event.target.value; const [sy, sm, sd] = startDate.split("-").map(Number); const [ey, em, ed] = next.split("-").map(Number); const difference = Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000); const count = Math.max(1, difference); setRentalDaysInput(String(count)); setReturnDate(difference < 1 ? rentalReturnDateFromDays(startDate, 1) : next); }} /></label><label className="field"><span>Return time</span><input required type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label></div><div className="duration-note"><CalendarRange size={16} /><strong>{days} rental days</strong><span>{startDate} → {returnDate}</span></div></section>
        {needsReplacement && selectedVehicle && <section className="replacement-conflict-panel"><div className="replacement-conflict-head"><AlertTriangle size={18} /><div><strong>{selectedVehicle.name} has a date conflict</strong><p>{requestedConflict ? `${requestedConflict.type === "booking" ? "Booking" : "Rental"} ${requestedConflict.label}${requestedConflict.customer ? ` for ${requestedConflict.customer}` : ""} overlaps this period.` : "The original vehicle is not operational for this period."} You can continue this same rental with a temporary vehicle.</p></div></div><div className="original-booking-context compact"><strong>Original Booking: {selectedVehicle.name} — {days} Days</strong><span>{selectedVehicle.name} remains the original requested vehicle even while a replacement is being used.</span></div><label className="field"><span>Temporary / replacement vehicle</span><select required value={replacementVehicleId} onChange={(event) => setReplacementVehicleId(event.target.value)}><option value="">Select replacement</option>{ownReplacements.length > 0 && <optgroup label="Our available vehicles">{ownReplacements.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate}</option>)}</optgroup>}{guestReplacements.length > 0 && <optgroup label="Guest Cars">{guestReplacements.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.plate} · Guest Car</option>)}</optgroup>}</select><small>{replacementChoices.length ? "Own vehicles are shown first. Guest Cars are listed separately below them." : "No replacement vehicle is available at the selected start time."}</small></label></section>}
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Vehicle handover</h3><p>{assignedVehicle ? `Record handover details for ${assignedVehicle.name}${assignedVehicle.isGuest ? " (Guest Car)" : ""}.` : "Select a replacement vehicle to continue."}</p></div></div><div className="field-grid three"><label className="field"><span>Current / Starting Kilometer</span><input required min="0" type="number" placeholder="0" value={blankZero(startingKilometer)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setStartingKilometer(numberFromInput(event.target.value))} /></label><label className="field"><span>Allowed KM Per Day</span><input readOnly value={`${assignedVehicle?.allowedKmPerDay ?? 0} km`} /></label><label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Starting Fuel Range (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(startingFuelRangeKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setStartingFuelRangeKm(numberFromInput(event.target.value))} /></label></div>{needsReplacement && assignedVehicle && <div className="replacement-rate-note"><CarFront size={15} /><span>{assignedVehicle.name}{assignedVehicle.isGuest ? " (Guest Car)" : ""} is the first usage segment and will be charged at its configured {money(assignedVehicle.rate)}/day rate in the final settlement.</span></div>}</section>
        <section className="form-section"><div className="form-section-title"><span><WalletCards size={17} /></span><div><h3>Payment details</h3><p>Record the advance and deposit received. Existing customer-payment flow stays unchanged.</p></div></div><div className="field-grid three"><label className="field"><span>Original daily rate (₹)</span><input required min="0" type="number" placeholder="0" value={blankZero(rate)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setRate(numberFromInput(event.target.value))} /></label><label className="field"><span>Security deposit (₹)</span><input min="0" type="number" inputMode="decimal" placeholder="0" value={blankZero(deposit)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDeposit(numberFromInput(event.target.value))} /></label><label className="field"><span>Advance paid (₹)</span><input min="0" max={total} type="number" inputMode="decimal" placeholder="0" value={blankZero(advance)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setAdvance(numberFromInput(event.target.value))} /></label><label className="field"><span>Discount (₹)</span><input min="0" max={rentalAmount} type="number" placeholder="0" value={blankZero(discount)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDiscount(numberFromInput(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div></section>
      </div>
      <footer className="rental-submit-footer">
        {error && <p className="form-error">{error}</p>}
        <div className="rental-submit-actions">
          <button className="confirm-rental" type="submit" disabled={saving || !selectedVehicle || !customerPhone || (needsReplacement && !replacementVehicle)}>{saving ? "Saving…" : "Confirm rental"} {!saving && <ArrowRight size={16} />}</button>
          <button className="save-draft" type="button" disabled={saving || !selectedVehicle || !customerPhone} onClick={() => void saveRental("draft")}>{saving ? "Saving…" : "Save as draft"}</button>
        </div>
      </footer>
    </form>
  </DialogShell>;
}

function RentalDetailDialog({ rental, close, switchDialog, sendWhatsApp, addExpense }: { rental: Rental; close: () => void; switchDialog: (dialog: DialogType) => void; sendWhatsApp: (rental: Rental, purpose?: string) => void; addExpense: () => void }) {
  const collectedPercent = rental.total > 0 ? Math.min(100, Math.round((rental.paid / rental.total) * 100)) : 100;
  const completed = rental.state === "completed";
  const showOriginalContext = rental.replacementUsed || rental.segments.length > 1 || rental.vehicleId !== rental.originalVehicleId;
  const formatOriginalPeriod = `${formatIndiaWhen(rental.originalStartAt)} → ${formatIndiaWhen(rental.originalEndAt)}`;
  return <DialogShell title={rental.id} subtitle={`${rental.vehicle} · ${rental.plate}${rental.isGuestCurrent ? " · Guest Car" : ""}`} close={close} wide>
    {showOriginalContext && <div className="original-booking-context rental-context-banner"><strong>Original Booking: {rental.originalVehicle} — {rental.originalDays} Days</strong><span>{rental.originalVehicle} was unavailable for part of this rental, so a temporary/replacement vehicle is being used. The original booking remains connected throughout every vehicle change.</span><small>{formatOriginalPeriod}</small></div>}
    <div className="detail-hero"><img src={rental.image} alt={`${rental.vehicle} vehicle`} /><div><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span>{rental.isGuestCurrent && <span className="guest-inline-badge">Guest Car</span>}<h2>{rental.vehicle}</h2><p>{rental.plate}</p></div><div className="detail-contact"><a href={`tel:${rental.phone.replaceAll(" ", "")}`}><Phone size={16} />Call</a><button onClick={() => sendWhatsApp(rental, completed ? "completed rental payment reminder" : "rental reminder")}><MessageCircle size={16} />WhatsApp</button></div></div>
    <div className="detail-layout"><div className="detail-main"><section className="detail-section"><div className="detail-title"><span><UserRound size={17} /></span><div><h3>Customer</h3><p>Verified customer details</p></div></div><div className="customer-detail-card"><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.phone}</small></div><div><small>Driving licence</small><strong>{rental.licence || "Not recorded"}</strong></div><ShieldCheck size={18} /></div></section><section className="detail-section"><div className="detail-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>{completed ? "Settlement completed — return details are locked" : "Original booking dates"}</p></div></div><div className="timeline"><div><i /><span><small>Rental started</small><strong>{rental.start}</strong></span></div><b /><div><i /><span><small>{completed ? "Returned" : "Expected return"}</small><strong>{rental.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Rental days</small><strong>{rental.days} days</strong></div><div><small>Current vehicle rate</small><strong>{money(rental.rate)}</strong></div><div><small>Current segment start KM</small><strong>{rental.startingKilometer.toLocaleString("en-IN")} km</strong></div><div><small>Current expected return KM</small><strong>{calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay).toLocaleString("en-IN")} km</strong></div><div><small>Fuel range at handover</small><strong>{rental.startingFuelRangeKm} km</strong></div><div><small>Allowed per day</small><strong>{rental.allowedKmPerDay} km</strong></div></div></section>
      {(rental.segments.length > 1 || rental.replacementUsed) && <section className="detail-section"><div className="detail-title"><span><RotateCcw size={17} /></span><div><h3>Vehicle usage</h3><p>All vehicles used within this same customer rental</p></div></div><div className="rental-segment-list">{rental.segments.map((segment) => <article key={segment.id} className={`rental-segment-card ${segment.status === "active" ? "active" : ""}`}><div className="segment-vehicle"><img src={segment.image} alt="" /><span><strong>{segment.vehicle}</strong><small>{segment.plate}{segment.isGuest ? " · Guest Car" : ""}</small></span><b>#{segment.sequence}</b></div><div className="segment-facts"><span><small>Used from</small><strong>{segment.start}</strong></span><span><small>Used to</small><strong>{segment.end}</strong></span><span><small>Start KM</small><strong>{segment.startingKilometer.toLocaleString("en-IN")}</strong></span><span><small>End KM</small><strong>{segment.endingKilometer === null ? "Current" : segment.endingKilometer.toLocaleString("en-IN")}</strong></span><span><small>Rental period</small><strong>{segment.rentalDays} day{segment.rentalDays === 1 ? "" : "s"}</strong></span><span><small>Vehicle charge</small><strong>{money(segment.rentalCharge + segment.extraKmCharge)}</strong></span></div></article>)}</div></section>}
      </div><aside className="financial-card"><div className="detail-title"><span><ReceiptIndianRupee size={17} /></span><div><h3>Financial summary</h3><p>{completed ? "Final settlement — payment only" : "Updated live"}</p></div></div><div className="financial-line"><span>Rental amount</span><strong>{money(rental.rentalAmount)}</strong></div><div className="financial-line"><span>Additional charges</span><strong>{money(rental.otherCharges)}</strong></div><div className="financial-line"><span>Discount</span><strong>− {money(rental.bookingDiscount)}</strong></div><div className="financial-total"><span>Total</span><strong>{money(rental.total)}</strong></div><div className="financial-line paid"><span>Amount paid</span><strong>{money(rental.paid)}</strong></div><div className="financial-balance"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><div className="paid-progress"><span style={{ width: `${collectedPercent}%` }} /></div><small className="paid-caption">{collectedPercent}% collected</small><button className="receive-button" onClick={() => switchDialog("payment")} disabled={rental.balance <= 0}><CreditCard size={16} />{rental.balance > 0 ? "Receive payment" : "Payment complete"}</button>{rental.guestRentalAmount > 0 && <div className="guest-accounting-note"><ShieldCheck size={14} /><span>Guest Car usage stays on this customer bill but is excluded from main business revenue/payment reports.</span></div>}</aside></div>
    {completed ? (rental.balance > 0 ? <footer className="detail-actions completed-payment-only"><button onClick={() => switchDialog("payment")} className="return-button"><CreditCard size={16} />Receive balance payment</button></footer> : null) : <footer className="detail-actions"><button onClick={() => switchDialog("extend")}><CalendarRange size={16} />Extend rental</button><button onClick={() => switchDialog("change-vehicle")}><RotateCcw size={16} />Change Vehicle</button><button onClick={addExpense}><ReceiptIndianRupee size={16} />Add expense</button><button onClick={() => switchDialog("return")} className="return-button"><CarFront size={16} />Return vehicle</button></footer>}
  </DialogShell>;
}

function PendingPaymentsDialog({ rentals, close, receive }: { rentals: Rental[]; close: () => void; receive: (rental: Rental) => void }) {
  const pending = rentals
    .filter((rental) => rental.state === "completed" && rental.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const totalPending = pending.reduce((sum, rental) => sum + rental.balance, 0);

  return <DialogShell title="Pending payments" subtitle="Completed rentals with an unpaid balance" close={close} wide>
    <div className="pending-payments-dialog">
      <div className="pending-payments-summary">
        <span><small>Completed rentals pending</small><strong>{pending.length}</strong></span>
        <span><small>Total to collect</small><strong>{money(totalPending)}</strong></span>
      </div>
      {pending.length ? <div className="pending-payments-list">
        {pending.map((rental) => <article className="pending-payment-card" key={rental.id}>
          <img src={rental.image} alt={`${rental.vehicle} ${rental.plate}`} />
          <div className="pending-payment-main">
            <strong>{rental.vehicle}</strong>
            <small>{rental.plate} · {rental.id}</small>
            <b>{rental.customer}</b>
            <small>Returned: {rental.returnDate}</small>
          </div>
          <div className="pending-payment-money">
            <span><small>Total</small><strong>{money(rental.total)}</strong></span>
            <span><small>Paid</small><strong>{money(rental.paid)}</strong></span>
            <span className="pending-balance"><small>Balance</small><strong>{money(rental.balance)}</strong></span>
          </div>
          <button className="primary-button pending-payment-action" onClick={() => receive(rental)}><CreditCard size={15} />Receive payment</button>
        </article>)}
      </div> : <div className="pending-payments-empty"><CheckCircle2 size={22} /><strong>All completed rentals are fully paid</strong><p>There are no completed rentals with a pending balance.</p></div>}
    </div>
  </DialogShell>;
}

function PaymentDialog({ rental, close, done }: { rental: Rental; close: () => void; done: (message: string) => void }) {
  const [amount, setAmount] = useState(rental.balance);
  const [method, setMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingNumber: rental.id, amount, method, notes, receivedBy: CURRENT_USER_NAME }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; payment?: { paymentNumber: string; balance: number } }>(response);
      if (!response.ok || !payload.payment) throw new Error(payload.error ?? "Could not record payment.");
      done(`${money(amount)} payment ${payload.payment.paymentNumber} recorded for ${rental.customer}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Receive payment" subtitle={`${rental.customer} · ${rental.id}`} close={close}><form className="simple-form" onSubmit={submit}><div className="amount-due"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><label className="field"><span>Amount received (₹)</span><input required min="0.01" max={rental.balance} step="0.01" type="number" inputMode="decimal" value={amount} onKeyDown={numericKeyOnly} onChange={(event) => setAmount(numberFromInput(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label><label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment note" /></label><div className="remaining-box"><span>Remaining after payment</span><strong>{money(Math.max(0, rental.balance - amount))}</strong></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || amount <= 0 || amount > rental.balance}><Check size={16} />{saving ? "Recording…" : "Record payment"}</button></div></form></DialogShell>;
}

function ExtendDialog({ rental, close, done }: { rental: Rental; close: () => void; done: (message: string) => void }) {
  const [days, setDays] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const extension = days * rental.rate;
  const newReturn = new Date(new Date(rental.endAt).getTime() + days * 86_400_000);
  const newReturnLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(newReturn);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/extensions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingNumber: rental.id, additionalDays: days, notes }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; extension?: { addedAmount: number; newEndAt: string } }>(response);
      if (!response.ok || !payload.extension) throw new Error(payload.error ?? "Could not extend rental.");
      done(`Rental extended by ${days} days · ${money(payload.extension.addedAmount)} added`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not extend rental.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Extend rental" subtitle={`${rental.vehicle} · ${rental.customer}`} close={close}><form className="simple-form" onSubmit={submit}><div className="extension-summary"><div><span>Current return</span><strong>{rental.returnDate}</strong></div><ArrowRight size={18} /><div><span>New return</span><strong>{newReturnLabel}</strong></div></div><label className="field"><span>Additional rental days</span><div className="stepper-input"><button type="button" onClick={() => setDays(Math.max(1, days - 1))}>−</button><input min="1" max="365" type="number" value={days} onChange={(event) => setDays(Math.max(1, Math.min(365, Number(event.target.value))))} /><button type="button" onClick={() => setDays(Math.min(365, days + 1))}>+</button></div></label><label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional extension note" /></label><div className="calculation-box"><div><span>{days} days × {money(rental.rate)}</span><strong>{money(extension)}</strong></div><div><span>Updated rental total</span><strong>{money(rental.total + extension)}</strong></div><div><span>Updated pending balance</span><strong>{money(rental.balance + extension)}</strong></div></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving}><CalendarRange size={16} />{saving ? "Extending…" : "Confirm extension"}</button></div></form></DialogShell>;
}

function ChangeVehicleDialog({ rental, vehicles, guestVehicles, bookings, rentals, close, done }: { rental: Rental; vehicles: Vehicle[]; guestVehicles: Vehicle[]; bookings: BookingRecord[]; rentals: Rental[]; close: () => void; done: (message: string) => void }) {
  const currentSegment = [...rental.segments].reverse().find((segment) => segment.status === "active") ?? rental.segments.at(-1) ?? null;
  const nowParts = indiaDateTimeParts(new Date().toISOString());
  const [changeDate, setChangeDate] = useState(nowParts.date);
  const [changeTime, setChangeTime] = useState(nowParts.time);
  const [endingKilometer, setEndingKilometer] = useState(currentSegment?.startingKilometer ?? rental.startingKilometer);
  const [returnFuelRangeKm, setReturnFuelRangeKm] = useState(currentSegment?.startingFuelRangeKm ?? rental.startingFuelRangeKm);
  const fuelPricePerLitre = 105;
  const [nextVehicleId, setNextVehicleId] = useState("");
  const [nextStartingKilometer, setNextStartingKilometer] = useState(0);
  const [nextStartingFuelRangeKm, setNextStartingFuelRangeKm] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeAt = new Date(`${changeDate}T${changeTime}:00+05:30`);
  const remainingEnd = new Date(rental.endAt).getTime() > changeAt.getTime() ? new Date(rental.endAt) : new Date(changeAt.getTime() + 60_000);
  const ownChoices = currentSegment ? availableReplacementVehicles(vehicles, changeAt, remainingEnd, bookings, rentals, currentSegment.vehicleId, rental.databaseId) : [];
  const guestChoices = currentSegment ? availableReplacementVehicles(guestVehicles, changeAt, remainingEnd, bookings, rentals, currentSegment.vehicleId, rental.databaseId) : [];
  const choices = [...ownChoices, ...guestChoices];
  const nextVehicle = choices.find((vehicle) => vehicle.id === nextVehicleId) ?? null;
  const currentVehicleDetails = currentSegment
    ? (currentSegment.isGuest ? guestVehicles : vehicles).find((vehicle) => vehicle.id === currentSegment.vehicleId) ?? null
    : null;

  useEffect(() => {
    if (!choices.some((vehicle) => vehicle.id === nextVehicleId)) setNextVehicleId(choices[0]?.id ?? "");
  }, [nextVehicleId, choices.map((vehicle) => vehicle.id).join("|")]);

  useEffect(() => {
    if (nextVehicle) setNextStartingKilometer(nextVehicle.odometerKm);
  }, [nextVehicle?.id]);

  const currentCharge = currentSegment && Number.isFinite(changeAt.getTime()) && changeAt.getTime() > new Date(currentSegment.startAt).getTime()
    ? calculateSegmentCharge({
        startAt: currentSegment.startAt,
        endAt: changeAt,
        dailyRate: currentSegment.dailyRate,
        startingKilometer: currentSegment.startingKilometer,
        endingKilometer: Math.max(endingKilometer, currentSegment.startingKilometer),
        allowedKmPerDay: currentSegment.isGuest ? (guestVehicles.find((item) => item.id === currentSegment.vehicleId)?.allowedKmPerDay ?? rental.allowedKmPerDay) : (vehicles.find((item) => item.id === currentSegment.vehicleId)?.allowedKmPerDay ?? rental.allowedKmPerDay),
        extraKmRate: currentSegment.isGuest ? (guestVehicles.find((item) => item.id === currentSegment.vehicleId)?.extraKmRate ?? rental.extraKmRate) : (vehicles.find((item) => item.id === currentSegment.vehicleId)?.extraKmRate ?? rental.extraKmRate),
      })
    : null;

  const currentAllowedKmPerDay = currentSegment
    ? (currentVehicleDetails?.allowedKmPerDay ?? rental.allowedKmPerDay)
    : 0;
  const currentAllowedKilometers = currentCharge ? currentCharge.rentalDays * currentAllowedKmPerDay : 0;
  const currentFuelShortageKm = currentSegment ? Math.max(0, currentSegment.startingFuelRangeKm - returnFuelRangeKm) : 0;
  const currentMileageKmPerLitre = currentVehicleDetails?.mileageKmPerLitre ?? rental.mileageKmPerLitre;
  const currentFuelLitres = currentFuelShortageKm > 0 && currentMileageKmPerLitre > 0
    ? currentFuelShortageKm / currentMileageKmPerLitre
    : 0;
  const currentFuelCharge = Math.round(currentFuelLitres * fuelPricePerLitre * 100) / 100;
  const currentSegmentTotal = currentCharge
    ? Math.round((currentCharge.rentalCharge + currentCharge.extraKmCharge + currentFuelCharge) * 100) / 100
    : 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      if (!currentSegment) throw new Error("Active vehicle segment was not found. Sync and try again.");
      if (!nextVehicle) throw new Error("Select an available next vehicle.");
      if (!Number.isFinite(changeAt.getTime()) || changeAt.getTime() <= new Date(currentSegment.startAt).getTime()) throw new Error("Vehicle change time must be after the current vehicle started.");
      if (endingKilometer < currentSegment.startingKilometer) throw new Error("Ending kilometer cannot be below the starting kilometer.");
      if (returnFuelRangeKm < 0) throw new Error("Return fuel range cannot be below zero.");
      const response = await fetch("/api/rentals/change-vehicle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingNumber: rental.id, changeAt: changeAt.toISOString(), endingKilometer, returnFuelRangeKm, fuelPricePerLitre, nextVehicleId: nextVehicle.id, nextStartingKilometer, nextStartingFuelRangeKm }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; change?: { finishedVehicle: string; finishedFuelCharge: number; finishedTotal: number; nextVehicle: string; nextVehicleGuest: boolean } }>(response);
      if (!response.ok || !payload.ok || !payload.change) throw new Error(payload.error ?? "Could not change the rental vehicle.");
      done(`${payload.change.finishedVehicle} segment closed at ${money(payload.change.finishedTotal)}. ${payload.change.nextVehicle}${payload.change.nextVehicleGuest ? " (Guest Car)" : ""} is now active on ${rental.id}.`);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not change the rental vehicle."); }
    finally { setSaving(false); }
  }

  return <DialogShell title="Change Vehicle" subtitle={`${rental.id} · same customer rental continues`} close={close} wide>
    <form className="simple-form change-vehicle-form" onSubmit={submit}>
      <div className="original-booking-context"><strong>Original Booking: {rental.originalVehicle} — {rental.originalDays} Days</strong><span>The current vehicle segment will close, but this rental and the original booking remain open.</span></div>
      {currentSegment && <section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>Finish current vehicle</h3><p>{currentSegment.vehicle} · {currentSegment.plate}{currentSegment.isGuest ? " · Guest Car" : ""}</p></div></div><div className="field-grid four"><label className="field"><span>Change date</span><input required type="date" min={dateInputValue(new Date(currentSegment.startAt))} value={changeDate} onChange={(event) => setChangeDate(event.target.value)} /></label><label className="field"><span>Change time</span><input required type="time" value={changeTime} onChange={(event) => setChangeTime(event.target.value)} /></label><label className="field"><span>Ending KM</span><input required type="number" min={currentSegment.startingKilometer} value={blankZero(endingKilometer)} onKeyDown={numericKeyOnly} onChange={(event) => setEndingKilometer(numberFromInput(event.target.value))} /></label><label className="field"><span>Return fuel range (KM)</span><input required type="number" min="0" value={blankZero(returnFuelRangeKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setReturnFuelRangeKm(numberFromInput(event.target.value))} /><small>Defaults to starting range: {currentSegment.startingFuelRangeKm} km</small></label></div>{currentCharge && <div className="segment-charge-preview change-segment-preview-v43"><span><small>Usage period</small><strong>{currentCharge.rentalDays} rental day{currentCharge.rentalDays === 1 ? "" : "s"}</strong></span><span><small>Allowed KM</small><strong>{currentAllowedKilometers.toLocaleString("en-IN")} km</strong></span><span><small>Rental charge</small><strong>{money(currentCharge.rentalCharge)}</strong></span><span><small>Extra KM</small><strong>{currentCharge.extraKilometers} km · {money(currentCharge.extraKmCharge)}</strong></span><span><small>Fuel shortage</small><strong>{currentFuelShortageKm} km · {money(currentFuelCharge)}</strong></span><span className="segment-total-preview"><small>Current segment total</small><strong>{money(currentSegmentTotal)}</strong></span></div>}</section>}
      <section className="form-section"><div className="form-section-title"><span><RotateCcw size={17} /></span><div><h3>Select next vehicle</h3><p>Our available vehicles are listed first, then Guest Cars. A vehicle with a later booking can be used now and changed again before that booking; future bookings stay protected.</p></div></div><label className="field"><span>Next vehicle</span><select required value={nextVehicleId} onChange={(event) => setNextVehicleId(event.target.value)}><option value="">Select vehicle</option>{ownChoices.length > 0 && <optgroup label="Our available vehicles">{ownChoices.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} — {vehicle.plate}</option>)}</optgroup>}{guestChoices.length > 0 && <optgroup label="Guest Cars">{guestChoices.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} — {vehicle.plate} · Guest Car</option>)}</optgroup>}</select>{!choices.length && <small className="red-text">No alternative vehicle is available at this change time.</small>}</label>{nextVehicle && <div className="field-grid three"><label className="field"><span>Starting KM — {nextVehicle.name}</span><input required type="number" min="0" value={blankZero(nextStartingKilometer)} onKeyDown={numericKeyOnly} onChange={(event) => setNextStartingKilometer(numberFromInput(event.target.value))} /></label><label className="field"><span>Starting fuel range (KM)</span><input required type="number" min="0" value={blankZero(nextStartingFuelRangeKm)} onKeyDown={numericKeyOnly} onChange={(event) => setNextStartingFuelRangeKm(numberFromInput(event.target.value))} /></label><label className="field"><span>Daily rate</span><input readOnly value={money(nextVehicle.rate)} /></label></div>}</section>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="primary-button" disabled={saving || !currentSegment || !nextVehicle}><RotateCcw size={16} />{saving ? "Changing…" : "Confirm vehicle change"}</button></div>
    </form>
  </DialogShell>;
}

function ReturnDialog({ rental, close, onConfirmed, sendSettlementWhatsApp }: { rental: Rental; close: () => void; onConfirmed: (result: SettlementResult) => void; sendSettlementWhatsApp: (phone: string, text: string) => void }) {
  const currentSegment = [...rental.segments].reverse().find((segment) => segment.status === "active") ?? rental.segments.at(-1) ?? null;
  const singleOriginalSegment = rental.segments.length <= 1 && (!currentSegment || currentSegment.vehicleId === rental.originalVehicleId);
  const expectedReturnKilometer = calculateExpectedReturnKilometer(rental.startingKilometer, Math.max(1, currentSegment?.rentalDays ?? rental.days), rental.allowedKmPerDay);
  const [actualReturnDate, setActualReturnDate] = useState(() => dateInputValue(new Date()));
  const [actualReturnTime, setActualReturnTime] = useState(() => indiaDateTimeParts(new Date().toISOString()).time);
  const [actualReturnKilometer, setActualReturnKilometer] = useState(expectedReturnKilometer);
  const [returnFuelRangeKm, setReturnFuelRangeKm] = useState(Math.max(0, rental.startingFuelRangeKm - 50));
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(105);
  const [cleaning, setCleaning] = useState(0);
  const [damage, setDamage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountRemark, setDiscountRemark] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [vehicleCondition, setVehicleCondition] = useState("Good — no new damage");
  const [sendToMaintenance, setSendToMaintenance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<SettlementResult | null>(null);

  const actualReturnIso = new Date(`${actualReturnDate}T${actualReturnTime}:00+05:30`).toISOString();
  const actualReturnMs = new Date(actualReturnIso).getTime();
  const scheduledReturnMs = new Date(rental.endAt).getTime();
  const graceReturnMs = scheduledReturnMs + 3 * 60 * 60 * 1000;
  const rentalStartMs = new Date(rental.startAt).getTime();
  const currentSegmentStartMs = new Date(currentSegment?.startAt ?? rental.startAt).getTime();
  const returnBeforeStart = actualReturnMs < rentalStartMs || actualReturnMs < currentSegmentStartMs;
  const earlyReturn = singleOriginalSegment && !returnBeforeStart && actualReturnMs < scheduledReturnMs;
  const withinGracePeriod = singleOriginalSegment && !returnBeforeStart && actualReturnMs >= scheduledReturnMs && actualReturnMs <= graceReturnMs;
  const returnDateTimeFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
  const expectedReturnLabel = returnDateTimeFormatter.format(new Date(scheduledReturnMs));
  const graceReturnLabel = returnDateTimeFormatter.format(new Date(graceReturnMs));
  const earlyReturnDays = earlyReturn ? Math.max(1, Math.ceil((scheduledReturnMs - actualReturnMs) / 86_400_000)) : 0;

  const completedSegments = rental.segments.filter((segment) => segment.status !== "active" && segment.id !== currentSegment?.id);
  const completedRentalCharge = completedSegments.reduce((sum, segment) => sum + segment.rentalCharge, 0);
  const completedExtraKmCharge = completedSegments.reduce((sum, segment) => sum + segment.extraKmCharge, 0);
  const liveCurrentSegmentCharge = currentSegment ? calculateSegmentCharge({
    startAt: currentSegment.startAt,
    endAt: actualReturnIso,
    dailyRate: currentSegment.dailyRate,
    startingKilometer: currentSegment.startingKilometer,
    endingKilometer: Math.max(actualReturnKilometer, currentSegment.startingKilometer),
    allowedKmPerDay: rental.allowedKmPerDay,
    extraKmRate: rental.extraKmRate,
  }) : null;

  const bookedBaseRentalAmount = Math.max(0, rental.rentalAmount - rental.bookingDiscount);
  const legacyBookingOtherCharges = Math.max(0, rental.otherCharges - rental.lateRentalCharge);
  const legacyRentalCharge = calculateRentalChargeForActualReturn(rental.startAt, rental.endAt, actualReturnIso, rental.rate, rental.days, bookedBaseRentalAmount);
  const legacyLateRental = calculateLateRentalCharge(rental.endAt, actualReturnIso, rental.rate, 3);

  const multiSegmentGross = completedRentalCharge + (liveCurrentSegmentCharge?.rentalCharge ?? 0);
  const multiRentalBaseAmount = Math.max(0, multiSegmentGross - Math.min(rental.bookingDiscount, multiSegmentGross));
  // snapshot otherCharges already includes completed segment extra-KM + live late charge.
  // Strip those derived values back to the booking's stored other charges, then add
  // the completed segment extra-KM exactly once, matching the settlement API.
  const storedBookingOtherCharges = Math.max(0, rental.otherCharges - completedExtraKmCharge - rental.lateRentalCharge);
  const rentalBaseAmount = singleOriginalSegment ? legacyRentalCharge.baseRentalAmount : multiRentalBaseAmount;
  const lateRental = singleOriginalSegment ? legacyLateRental : { extraRentalDays: 0, charge: 0 };
  const settlementExistingOtherCharges = singleOriginalSegment ? legacyBookingOtherCharges : storedBookingOtherCharges + completedExtraKmCharge;
  const currentRentalDays = singleOriginalSegment ? rental.days : Math.max(1, liveCurrentSegmentCharge?.rentalDays ?? 1);

  const calculationRaw = calculateSettlement({
    baseRentalAmount: rentalBaseAmount,
    existingOtherCharges: settlementExistingOtherCharges,
    rentalDays: currentRentalDays,
    startingKilometer: rental.startingKilometer,
    actualReturnKilometer,
    allowedKmPerDay: rental.allowedKmPerDay,
    extraKmRate: rental.extraKmRate,
    startingFuelRangeKm: rental.startingFuelRangeKm,
    returnFuelRangeKm,
    mileageKmPerLitre: rental.mileageKmPerLitre,
    fuelPricePerLitre,
    lateFee: lateRental.charge,
    cleaningCharge: cleaning,
    damageCharge: damage,
    discountAmount,
    amountAlreadyPaid: rental.paid,
  });
  const roundedFinalAmount = Math.max(0, Math.round(calculationRaw.finalAmount));
  const calculation = { ...calculationRaw, finalAmount: roundedFinalAmount, amountDue: Math.max(0, Math.round(roundedFinalAmount - rental.paid)) };

  const previewSegments = rental.segments.map((segment) => segment.id === currentSegment?.id ? {
    ...segment,
    endAt: actualReturnIso,
    end: formatIndiaWhen(actualReturnIso),
    endingKilometer: actualReturnKilometer,
    rentalDays: liveCurrentSegmentCharge?.rentalDays ?? segment.rentalDays,
    rentalCharge: singleOriginalSegment ? rentalBaseAmount : (liveCurrentSegmentCharge?.rentalCharge ?? segment.rentalCharge),
    extraKilometers: liveCurrentSegmentCharge?.extraKilometers ?? 0,
    extraKmCharge: calculation.extraKmCharge,
    returnFuelRangeKm,
    fuelRangeShortageKm: calculation.fuelRangeShortageKm,
    fuelPricePerLitre,
    fuelCharge: calculation.fuelCharge,
  } : segment);

  async function confirmSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingNumber: rental.id, actualReturnAt: actualReturnIso, actualReturnKilometer, returnFuelRangeKm, fuelPricePerLitre, cleaningCharge: cleaning, damageCharge: damage, discountAmount, discountRemark, returnNotes, vehicleCondition, sendToMaintenance: rental.isGuestCurrent ? false : sendToMaintenance }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; settlement?: SettlementResult }>(response);
      if (!response.ok || !payload.settlement) throw new Error(payload.error ?? "Could not confirm the return settlement.");
      setConfirmed(payload.settlement);
      onConfirmed(payload.settlement);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Could not confirm the return settlement."); }
    finally { setSaving(false); }
  }

  const sendConfirmedWhatsApp = () => {
    if (!confirmed) return;
    const digits = (rental.whatsappNumber || rental.phone).replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits.startsWith("0") && digits.length === 11 ? `91${digits.slice(1)}` : digits;
    sendSettlementWhatsApp(phone, confirmed.whatsappMessage);
  };

  if (confirmed) {
    return <DialogShell title="Settlement confirmed" subtitle={`${rental.id} · final customer bill`} close={close} wide>
      <div className="settlement-success"><span><CheckCircle2 size={25} /></span><h3>Return settlement saved</h3><p>{rental.id} is completed and the final vehicle is {confirmed.vehicleStatus === "available" ? "available for future use" : "marked for maintenance"}.</p>{confirmed.segments && confirmed.segments.length > 1 && <div className="settlement-segment-summary">{confirmed.segments.map((segment) => <article key={`${segment.sequence}-${segment.vehicleId}`}><div><strong>{segment.vehicleName}{segment.isGuest ? " · Guest Car" : ""}</strong><small>{segment.registrationNumber}</small></div><span>{segment.bookingStart} → {segment.bookingEnd}</span><b>{segment.rentalDays} day{segment.rentalDays === 1 ? "" : "s"} · {money(segment.rentalCharge + segment.extraKmCharge + segment.fuelCharge)}</b>{segment.fuelCharge > 0 && <small className="segment-fuel-note">Fuel {segment.fuelRangeShortageKm} km · {money(segment.fuelCharge)}</small>}</article>)}</div>}<div><small>Final amount</small><strong>{money(confirmed.calculation.finalAmount)}</strong></div><button type="button" className="whatsapp-button" onClick={sendConfirmedWhatsApp}><MessageCircle size={17} />Send Details via WhatsApp</button><small>WhatsApp opens with the existing settlement message plus vehicle-wise usage. Review it and press Send yourself.</small><button type="button" className="save-draft" onClick={close}>Close</button></div>
    </DialogShell>;
  }

  return <DialogShell title="Return vehicle" subtitle={`${rental.vehicle} · ${rental.plate}${rental.isGuestCurrent ? " · Guest Car" : ""}`} close={close} wide>
    <form className="return-form" onSubmit={confirmSettlement}>
      <div className="return-fields">
        {(rental.replacementUsed || rental.segments.length > 1) && <div className="original-booking-context rental-context-banner"><strong>Original Booking: {rental.originalVehicle} — {rental.originalDays} Days</strong><span>This final settlement closes the complete customer rental after all vehicle segments are included.</span></div>}
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Return inspection</h3><p>Actual return date and time default to now. Change them if the handover happened at a different time.</p></div></div>
          <div className="return-deadline-card"><div><span>Expected return</span><strong>{expectedReturnLabel}</strong></div><ArrowRight size={18} /><div className="grace-deadline"><span>3-hour grace deadline</span><strong>{graceReturnLabel}</strong><small>{singleOriginalSegment ? "Extra-day rent starts only after this time." : "The current segment follows the same daily cooling rule."}</small></div></div>
          <div className="field-grid three"><label className="field"><span>Actual return date</span><input required min={dateInputValue(new Date(currentSegment?.startAt ?? rental.startAt))} type="date" value={actualReturnDate} onChange={(event) => setActualReturnDate(event.target.value)} /></label><label className="field"><span>Actual return time</span><input required type="time" value={actualReturnTime} onChange={(event) => setActualReturnTime(event.target.value)} /></label><label className="field"><span>Actual Return Kilometer</span><input required min={rental.startingKilometer} type="number" placeholder="0" value={blankZero(actualReturnKilometer)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setActualReturnKilometer(numberFromInput(event.target.value))} /></label><label className="field"><span>Starting Kilometer</span><input readOnly value={`${rental.startingKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${calculation.expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Total Allowed Kilometers</span><input readOnly value={`${calculation.allowedKilometers.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Starting Fuel Range (KM)</span><input readOnly value={rental.startingFuelRangeKm} /></label><label className="field"><span>Return Fuel Range (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(returnFuelRangeKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setReturnFuelRangeKm(numberFromInput(event.target.value))} /></label><label className="field"><span>Current Fuel Price Per Litre (₹)</span><input required min="0" step="0.01" type="number" placeholder="0" value={blankZero(fuelPricePerLitre)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setFuelPricePerLitre(numberFromInput(event.target.value))} /></label><label className="field span-2"><span>Vehicle condition</span><select value={vehicleCondition} onChange={(event) => setVehicleCondition(event.target.value)}><option>Good — no new damage</option><option>Minor new damage</option><option>Major damage</option></select></label></div>
          {returnBeforeStart && <p className="form-error">Actual return date/time cannot be before the current vehicle segment started.</p>}{earlyReturn && <div className="early-return-note"><CheckCircle2 size={15} /><span>Early return: approximately {earlyReturnDays} day{earlyReturnDays === 1 ? "" : "s"} before the expected return. Settlement rent is recalculated live to {legacyRentalCharge.chargeableRentalDays} chargeable day{legacyRentalCharge.chargeableRentalDays === 1 ? "" : "s"} × {money(rental.rate)} = {money(legacyRentalCharge.baseRentalAmount)}. A 3-hour cooling period applies at each daily rent boundary. The original booking stays unchanged.</span></div>}{withinGracePeriod && <div className="grace-return-note"><Clock3 size={15} /><span>Within the 3-hour grace period. No extra rental-day charge applies until {graceReturnLabel}.</span></div>}
        </section>
        {(rental.segments.length > 1 || rental.replacementUsed) && <section className="form-section"><div className="form-section-title"><span><RotateCcw size={17} /></span><div><h3>Vehicle-wise settlement</h3><p>Every vehicle period stays inside this one rental.</p></div></div><div className="settlement-segment-preview">{previewSegments.map((segment) => <article key={segment.id}><div><strong>Vehicle {segment.sequence} — {segment.vehicle}{segment.isGuest ? " · Guest Car" : ""}</strong><small>{segment.plate}</small></div><span><small>Used from</small><b>{segment.start}</b></span><span><small>Used to</small><b>{segment.end}</b></span><span><small>Rental period</small><b>{segment.rentalDays} day{segment.rentalDays === 1 ? "" : "s"}</b></span><span><small>Rental charge</small><b>{money(segment.rentalCharge)}</b></span>{segment.extraKmCharge > 0 && <span><small>Extra KM charge</small><b>{money(segment.extraKmCharge)}</b></span>}{segment.fuelCharge > 0 && <span className="segment-fuel-breakdown"><small>Fuel shortage</small><b>{segment.fuelRangeShortageKm} km · {money(segment.fuelCharge)}</b></span>}<span className="segment-total-breakdown"><small>Vehicle total</small><b>{money(segment.rentalCharge + segment.extraKmCharge + segment.fuelCharge)}</b></span></article>)}</div></section>}
        <section className="form-section"><div className="form-section-title"><span><IndianRupee size={17} /></span><div><h3>Additional charges</h3><p>Extra KM and fuel shortage use the current vehicle&apos;s existing rules. Existing charges are preserved.</p></div></div><div className="charge-grid"><label><span>Extra KM ({calculation.extraKilometers} km)</span><input readOnly value={calculation.extraKmCharge} /></label><label><span>Fuel shortage ({calculation.fuelRangeShortageKm} km)</span><input readOnly value={calculation.fuelCharge} /></label><label><span>Late return charge ({lateRental.extraRentalDays} extra day{lateRental.extraRentalDays === 1 ? "" : "s"})</span><input readOnly value={lateRental.charge} /></label><label><span>Cleaning</span><input min="0" type="number" placeholder="0" value={blankZero(cleaning)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setCleaning(numberFromInput(event.target.value))} /></label><label><span>Damage</span><input min="0" type="number" placeholder="0" value={blankZero(damage)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDamage(numberFromInput(event.target.value))} /></label></div><p className="calculation-note">Rent rule: each 24-hour rental-day boundary gets a 3-hour cooling period. Fuel needed: {calculation.requiredFuelLitres.toFixed(3)} L · Mileage: {rental.mileageKmPerLitre} km/L · Extra KM rate: {money(rental.extraKmRate)}/km</p><label className="field"><span>Return notes</span><textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Condition, damage or payment notes" /></label></section>
      </div>
      <aside className="final-bill"><h3>Final bill</h3><div><span>{singleOriginalSegment ? `Rental amount (${legacyRentalCharge.chargeableRentalDays} day${legacyRentalCharge.chargeableRentalDays === 1 ? "" : "s"})` : `Combined vehicle rental (${previewSegments.reduce((sum, segment) => sum + segment.rentalDays, 0)} segment-days)`}</span><strong>{money(rentalBaseAmount)}</strong></div>{settlementExistingOtherCharges > 0 && <div><span>Previous-segment extra KM / fuel & other charges</span><strong>{money(settlementExistingOtherCharges)}</strong></div>}<div><span>Current vehicle extra kilometer</span><strong>{money(calculation.extraKmCharge)}</strong></div><div><span>Fuel shortage charge</span><strong>{money(calculation.fuelCharge)}</strong></div>{lateRental.charge > 0 && <div><span>Late rental charge</span><strong>{money(lateRental.charge)}</strong></div>}<div><span>Cleaning / damage</span><strong>{money(cleaning + damage)}</strong></div><div className="final-total"><span>Subtotal</span><strong>{money(calculation.subtotal)}</strong></div><label className="field"><span>Discount Amount (optional)</span><input min="0" max={calculation.subtotal} step="0.01" type="number" placeholder="0" value={blankZero(discountAmount)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDiscountAmount(numberFromInput(event.target.value))} /></label><label className="field"><span>Discount Remark (optional)</span><input value={discountRemark} onChange={(event) => setDiscountRemark(event.target.value)} placeholder="e.g. Regular Customer" /></label><div className="final-total"><span>Final amount</span><strong>{money(calculation.finalAmount)}</strong><small>Rounded to nearest whole rupee</small></div><div className="paid"><span>Already recorded</span><strong>− {money(rental.paid)}</strong></div><div className="due"><span>Balance due</span><strong>{money(calculation.amountDue)}</strong></div>{!rental.isGuestCurrent && <label className="maintenance-check"><input type="checkbox" checked={sendToMaintenance} onChange={(event) => setSendToMaintenance(event.target.checked)} /><span><Wrench size={16} /><span><strong>Send to maintenance</strong><small>Vehicle will not become available</small></span></span></label>}{rental.isGuestCurrent && <div className="guest-accounting-note"><ShieldCheck size={14} /><span>Guest Car will be released after settlement. No maintenance record is created.</span></div>}{error && <p className="form-error">{error}</p>}<button type="submit" className="confirm-rental" disabled={saving || returnBeforeStart}>{saving ? "Confirming…" : "Confirm Settlement"} {!saving && <Check size={16} />}</button><button type="button" className="save-draft" onClick={close}>Cancel</button></aside>
    </form>
  </DialogShell>;
}

function ExpenseDialog({ vehicles, rentals, seedRentalId, currentUser, close, done }: { vehicles: Vehicle[]; rentals: Rental[]; seedRentalId: string | null; currentUser: AuthUser; close: () => void; done: (message: string) => void }) {
  const seededRental = rentals.find((rental) => rental.databaseId === seedRentalId) ?? null;
  const [expenseDate, setExpenseDate] = useState(() => dateInputValue(new Date()));
  const [category, setCategory] = useState("Vehicle service");
  const [association, setAssociation] = useState<"rental" | "vehicle" | "general">(seededRental ? "rental" : "general");
  const [rentalId, setRentalId] = useState(seededRental?.databaseId ?? "");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rentalChoices = useMemo(() => [...rentals].sort((a, b) => {
    const aActive = a.state === "completed" ? 1 : 0;
    const bActive = b.state === "completed" ? 1 : 0;
    return aActive - bActive || new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  }), [rentals]);
  const linkedRental = association === "rental" ? rentals.find((rental) => rental.databaseId === rentalId) ?? null : null;
  const linkedVehicleRegistration = linkedRental?.plate ?? "";

  function changeAssociation(next: "rental" | "vehicle" | "general") {
    setAssociation(next);
    setError(null);
    if (next !== "rental") setRentalId("");
    if (next !== "vehicle") setVehicleRegistration("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (association === "rental" && !linkedRental) return setError("Select the rental this expense belongs to.");
    if (association === "vehicle" && !vehicleRegistration) return setError("Select a vehicle for this direct vehicle expense.");
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expenseDate, category, bookingId: linkedRental?.databaseId ?? null, vehicleRegistration: association === "rental" ? linkedVehicleRegistration : association === "vehicle" ? vehicleRegistration : null, amount, description, method }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; expense?: { expenseNumber: string; paidBy?: string } }>(response);
      if (!response.ok || !payload.expense) throw new Error(payload.error ?? "Could not save expense.");
      done(`${money(amount)} expense ${payload.expense.expenseNumber} recorded · paid by ${payload.expense.paidBy ?? currentUser.username}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Add expense" subtitle="Link it to a rental, a vehicle, or record a general business expense" close={close}><form className="simple-form expense-smart-form" onSubmit={submit}>
    <div className="expense-paid-by"><UserRound size={15} /><span><small>Paid by</small><strong>{currentUser.username}</strong></span><em>Logged-in account</em></div>
    <div className="field-grid"><label className="field"><span>Date</span><input required type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label><label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Vehicle service</option><option>Repair</option><option>Insurance</option><option>Fuel</option><option>Cleaning</option><option>Parking / toll</option><option>Office expense</option><option>Other</option></select></label></div>
    <label className="field"><span>Expense for</span><select value={association} onChange={(event) => changeAssociation(event.target.value as "rental" | "vehicle" | "general")}><option value="rental">Associated rental</option><option value="vehicle">Vehicle directly</option><option value="general">General business</option></select><small>Rental-linked expenses are for reporting only and never reduce the customer rental balance.</small></label>
    {association === "rental" && <><label className="field"><span>Associated rental</span><select required value={rentalId} onChange={(event) => setRentalId(event.target.value)}><option value="">Select rental</option>{rentalChoices.map((rental) => <option key={rental.databaseId} value={rental.databaseId}>{rental.id} · {rental.customer} · {rental.vehicle} ({rental.plate}){rental.state === "completed" ? " · Completed" : " · Active"}</option>)}</select></label>{linkedRental && <div className="expense-linked-rental"><CarFront size={16} /><span><strong>{linkedRental.vehicle} · {linkedRental.plate}</strong><small>{linkedRental.customer} · {linkedRental.id}</small></span><b>Vehicle selected automatically</b></div>}</>}
    {association === "vehicle" && <label className="field"><span>Vehicle</span><select required value={vehicleRegistration} onChange={(event) => { setVehicleRegistration(event.target.value); setRentalId(""); }}><option value="">Select vehicle</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.name} · {vehicle.plate}{vehicle.isGuest ? " · Guest Car" : ""}</option>)}</select><small>No rental will be associated with a direct vehicle expense.</small></label>}
    {association === "general" && <div className="expense-general-note"><ReceiptIndianRupee size={16} /><span><strong>General business expense</strong><small>No rental or vehicle will be linked.</small></span></div>}
    <div className="field-grid"><label className="field"><span>Amount (₹)</span><input required min="0.01" step="0.01" type="number" inputMode="decimal" placeholder="0" value={blankZero(amount)} onKeyDown={numericKeyOnly} onChange={(event) => setAmount(numberFromInput(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div>
    <label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this expense for?" /></label>
    {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || amount <= 0}><Check size={16} />{saving ? "Saving…" : "Save expense"}</button></div>
  </form></DialogShell>;
}

