"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { calculateExpectedReturnKilometer, calculateLateRentalCharge, calculateSettlement } from "@/lib/rental-calculations";
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
  Phone,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  UserRoundPlus,
  UsersRound,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";

type View = "dashboard" | "rentals" | "vehicles" | "customers" | "payments" | "accounts" | "reports" | "settings";
type DialogType = null | "new-rental" | "rental-detail" | "payment" | "extend" | "return" | "expense" | "vehicle" | "vehicle-detail" | "customer";
type RentalState = "active" | "today" | "overdue" | "completed";

type Rental = {
  id: string;
  databaseId: string;
  vehicleId: string;
  customerId: string;
  vehicle: string;
  plate: string;
  image: string;
  customer: string;
  phone: string;
  whatsappNumber: string;
  licence: string;
  start: string;
  returnDate: string;
  startAt: string;
  endAt: string;
  days: number;
  rate: number;
  rentalAmount: number;
  bookingDiscount: number;
  otherCharges: number;
  lateRentalDays: number;
  lateRentalCharge: number;
  total: number;
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
};

type SettlementResult = {
  settlementId: string;
  bookingNumber: string;
  vehicleStatus: "available" | "maintenance";
  calculation: ReturnType<typeof calculateSettlement>;
  whatsappMessage: string;
  whatsappUrl: string;
};

type CustomerRow = {
  id: string; name: string; initials: string; phone: string; whatsappNumber: string; city: string; licence: string; fullLicence: string; rentals: number; spent: number; pending: number; active: string | null; activeRentalId: string | null; createdAt: string;
};

type PaymentRow = {
  id: string; customer: string; phone: string; rental: string; date: string; receivedAt: string; amount: number; method: string; type: string; receivedBy: string; notes: string | null;
};

type ExpenseRow = {
  id: string; rawDate: string; date: string; category: string; vehicle: string; vehicleId: string | null; description: string; method: string; amount: number; createdBy: string;
};

type ReminderRow = { key: string; tone: string; type: string; title: string; text: string; rentalId?: string };

type Metrics = {
  totalCars: number; availableCars: number; onRentCars: number; maintenanceCars: number; roadReadyPercent: number; activeRentals: number; returningToday: number; overdue: number; outstanding: number; outstandingRentals: number; outstandingCustomers: number; totalCustomers: number; newCustomersThisMonth: number; currentlyRentingCustomers: number; collectedToday: number; paymentsToday: number; expensesToday: number; netToday: number; collectedMonth: number; collectedLastMonth: number; collectionChangePercent: number; rentalRevenueMonth: number; expensesMonth: number; netIncomeMonth: number; depositsHeld: number; twelveMonthCollected: number; monthlyCollected: { key: string; label: string; amount: number }[];
};

type AppSnapshot = { ok: boolean; error?: string; rentals: Rental[]; vehicles: Vehicle[]; vehicleProfiles: Record<string, VehicleProfilePayload>; customers: CustomerRow[]; payments: PaymentRow[]; expenses: ExpenseRow[]; reminders: ReminderRow[]; metrics: Metrics };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type ReportType = "rentals" | "payments" | "expenses" | "outstanding" | "cars";

const emptyMetrics: Metrics = { totalCars: 0, availableCars: 0, onRentCars: 0, maintenanceCars: 0, roadReadyPercent: 0, activeRentals: 0, returningToday: 0, overdue: 0, outstanding: 0, outstandingRentals: 0, outstandingCustomers: 0, totalCustomers: 0, newCustomersThisMonth: 0, currentlyRentingCustomers: 0, collectedToday: 0, paymentsToday: 0, expensesToday: 0, netToday: 0, collectedMonth: 0, collectedLastMonth: 0, collectionChangePercent: 0, rentalRevenueMonth: 0, expensesMonth: 0, netIncomeMonth: 0, depositsHeld: 0, twelveMonthCollected: 0, monthlyCollected: [] };

const navItems: { label: string; view: View; icon: LucideIcon; badge?: string }[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Rentals", view: "rentals", icon: CalendarRange, badge: "3" },
  { label: "Vehicles", view: "vehicles", icon: CarFront },
  { label: "Customers", view: "customers", icon: UsersRound },
  { label: "Payments", view: "payments", icon: WalletCards },
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

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [dialog, setDialog] = useState<DialogType>(null);
  const [rentalList, setRentalList] = useState<Rental[]>([]);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([]);
  const [vehicleProfiles, setVehicleProfiles] = useState<Record<string, VehicleProfilePayload>>({});
  const [customerList, setCustomerList] = useState<CustomerRow[]>([]);
  const [paymentList, setPaymentList] = useState<PaymentRow[]>([]);
  const [expenseList, setExpenseList] = useState<ExpenseRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installBannerVisible, setInstallBannerVisible] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      const payload = await readApiResponse<AppSnapshot>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load live database data.");
      setRentalList(payload.rentals);
      setVehicleList(payload.vehicles);
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
      showToast(error instanceof Error ? error.message : "Could not load live database data.");
    }
  }, [showToast]);

  useEffect(() => { void refreshData(); }, [refreshData]);

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
    setBiometricSupported(typeof window !== "undefined" && "PublicKeyCredential" in window);
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker registration failed", error));
    }
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(promptEvent);
      if (localStorage.getItem("mecardee-install-dismissed") !== "1") setInstallBannerVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const vehicleResults = vehicleList.filter((v) => `${v.name} ${v.plate}`.toLowerCase().includes(query)).map((v) => ({ type: "Vehicle", title: v.name, meta: `${v.plate} · ${v.status}`, action: () => openVehicle(v) }));
    const customerResults = customerList.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query)).map((c) => ({ type: "Customer", title: c.name, meta: `${c.phone} · ${c.rentals} rentals`, action: () => goTo("customers") }));
    const rentalResults = rentalList.filter((r) => `${r.id} ${r.vehicle} ${r.plate} ${r.customer}`.toLowerCase().includes(query)).map((r) => ({ type: "Rental", title: r.id, meta: `${r.vehicle} · ${r.customer}`, action: () => openRental(r) }));
    return [...vehicleResults, ...customerResults, ...rentalResults].slice(0, 6);
  }, [search, rentalList, vehicleList, customerList]);

  function goTo(next: View) {
    setView(next);
    setMobileMenuOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openRental(rental: Rental) {
    setSelectedRental(rental);
    setDialog("rental-detail");
    setSearch("");
  }

  function openVehicle(vehicle: Vehicle) {
    setSelectedVehicle(vehicle);
    setDialog("vehicle-detail");
    setSearch("");
  }

  function openRentalById(rentalId: string) {
    const rental = rentalList.find((item) => item.id === rentalId);
    if (rental) openRental(rental);
  }

  function openPayment() {
    const rental = [...rentalList].filter((item) => item.balance > 0).sort((a, b) => b.balance - a.balance)[0];
    if (!rental) return showToast("There are no outstanding rental balances.");
    setSelectedRental(rental);
    setDialog("payment");
  }

  function sendWhatsApp(rental: Rental, purpose = "rental reminder") {
    const digits = (rental.whatsappNumber || rental.phone).replace(/\D/g, "");
    const phone = digits.length === 10 ? `91${digits}` : digits.startsWith("0") && digits.length === 11 ? `91${digits.slice(1)}` : digits;
    const text = `Mecardee Rental — ${purpose}\n\nCustomer: ${rental.customer}\nVehicle: ${rental.vehicle} (${rental.plate})\nBooking: ${rental.id}\nExpected return: ${rental.returnDate}\nBalance due: ${money(rental.balance)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }


  function exportPayments() {
    if (!paymentList.length) return showToast("No payments to export.");
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Payment", "Customer", "Rental", "Date", "Method", "Amount", "Received by"], ...paymentList.map((payment) => [payment.id, payment.customer, payment.rental, payment.date, payment.method, payment.amount, payment.receivedBy])];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `mecardee-payments-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function manualSync() {
    if (syncing) return;
    setSyncing(true);
    try {
      await refreshData();
      showToast("Mecardee synced");
    } finally { setSyncing(false); }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallBannerVisible(false);
      setInstallPrompt(null);
      showToast("Mecardee installed");
    }
  }

  function dismissInstallPrompt() {
    localStorage.setItem("mecardee-install-dismissed", "1");
    setInstallBannerVisible(false);
  }

  function handleSettlementConfirmed(result: SettlementResult) {
    showToast(`Return settlement ${result.bookingNumber} confirmed`);
    void refreshData();
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} goTo={goTo} metrics={metrics} />
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
            <button className="icon-button mobile-sync-button" onClick={() => void manualSync()} aria-label="Sync latest data"><RefreshCw size={18} className={syncing ? "spin" : ""} /></button>
            <div className="notification-wrap" ref={notificationRef}>
              <button className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={18} />{reminders.length > 0 && <span className="notification-dot" />}</button>
              {notificationsOpen && <Notifications reminders={reminders} onClose={() => setNotificationsOpen(false)} openRental={openRentalById} />}
            </div>
            <button className="primary-button" onClick={() => setDialog("new-rental")}><Plus size={17} /> New rental</button>
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
          {view === "dashboard" && <Dashboard rentals={rentalList} metrics={metrics} reminders={reminders} openRental={openRental} openNew={() => setDialog("new-rental")} goTo={goTo} sendWhatsApp={sendWhatsApp} />}
          {view === "rentals" && <RentalsView rentals={rentalList} metrics={metrics} openRental={openRental} openNew={() => setDialog("new-rental")} />}
          {view === "vehicles" && <VehiclesView vehicles={vehicleList} metrics={metrics} openNew={() => setDialog("new-rental")} addVehicle={() => setDialog("vehicle")} openVehicle={openVehicle} showToast={showToast} />}
          {view === "customers" && <CustomersView customers={customerList} metrics={metrics} openNew={() => setDialog("new-rental")} openRentalById={openRentalById} addCustomer={() => setDialog("customer")} />}
          {view === "payments" && <PaymentsView rentals={rentalList} payments={paymentList} metrics={metrics} openPayment={openPayment} exportPayments={exportPayments} sendWhatsApp={sendWhatsApp} />}
          {view === "accounts" && <AccountsView expenses={expenseList} metrics={metrics} openExpense={() => setDialog("expense")} />}
          {view === "reports" && <ReportsView rentals={rentalList} payments={paymentList} expenses={expenseList} vehicles={vehicleList} />}
          {view === "settings" && <SettingsView lastSyncedAt={lastSyncedAt} syncing={syncing} onSync={() => void manualSync()} installAvailable={Boolean(installPrompt)} onInstall={() => void installApp()} biometricSupported={biometricSupported} />}
        </div>
      </main>

      <MobileNav view={view} goTo={goTo} openNew={() => setDialog("new-rental")} />
      {installBannerVisible && installPrompt && <InstallAppPrompt onInstall={() => void installApp()} onClose={dismissInstallPrompt} />}
      {mobileMenuOpen && <MobileMenu view={view} goTo={goTo} close={() => setMobileMenuOpen(false)} />}
      {dialog === "new-rental" && <NewRentalDialog vehicles={vehicleList} customers={customerList} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} showToast={showToast} />}
      {dialog === "rental-detail" && selectedRental && <RentalDetailDialog rental={selectedRental} close={() => setDialog(null)} switchDialog={setDialog} sendWhatsApp={sendWhatsApp} />}
      {dialog === "payment" && selectedRental && <PaymentDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "extend" && selectedRental && <ExtendDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "return" && selectedRental && <ReturnDialog rental={selectedRental} close={() => setDialog(null)} onConfirmed={handleSettlementConfirmed} />}
      {dialog === "customer" && <CustomerDialog close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "vehicle" && <VehicleDialog close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "vehicle-detail" && selectedVehicle && <DialogShell title={selectedVehicle.name} subtitle={`${selectedVehicle.plate} · Vehicle profile`} close={() => setDialog(null)} wide><VehicleDetailsClient vehicleId={selectedVehicle.id} embedded initialData={vehicleProfiles[selectedVehicle.id] ?? null} onChanged={() => void refreshData()} /></DialogShell>}
      {dialog === "expense" && <ExpenseDialog vehicles={vehicleList} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast}</span></div>}
    </div>
  );
}

function Sidebar({ view, goTo, metrics }: { view: View; goTo: (view: View) => void; metrics: Metrics }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div>
    <nav aria-label="Primary navigation">
      <span className="nav-label">WORKSPACE</span>
      {navItems.slice(0, 6).map((item) => { const Icon = item.icon; const badge = item.view === "rentals" && metrics.activeRentals > 0 ? String(metrics.activeRentals) : null; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span>{badge && <b>{badge}</b>}</button>; })}
      <span className="nav-label lower">INSIGHTS</span>
      {navItems.slice(6).map((item) => { const Icon = item.icon; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span></button>; })}
    </nav>
    <div className="sidebar-health"><div className="health-head"><span className="pulse" /><strong>Fleet health</strong><b>{metrics.roadReadyPercent}%</b></div><div className="health-bar"><span style={{ width: `${metrics.roadReadyPercent}%` }} /></div><small>{Math.max(0, metrics.totalCars - metrics.maintenanceCars)} of {metrics.totalCars} vehicles are road-ready</small></div>
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
  return Wrench;
}

function Dashboard({ rentals, metrics, reminders, openRental, openNew, goTo, sendWhatsApp }: { rentals: Rental[]; metrics: Metrics; reminders: ReminderRow[]; openRental: (rental: Rental) => void; openNew: () => void; goTo: (view: View) => void; sendWhatsApp: (rental: Rental, purpose?: string) => void }) {
  const focus = rentals.find((rental) => rental.state === "overdue") ?? rentals.find((rental) => rental.state === "today") ?? rentals.find((rental) => rental.state !== "completed");
  const active = rentals.filter((rental) => rental.state !== "completed");
  const dateLabel = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date()).toUpperCase();
  const stats = [
    { label: "Total cars", value: String(metrics.totalCars), note: "Registered fleet", icon: CarFront, tone: "neutral" },
    { label: "Available", value: String(metrics.availableCars), note: "Ready to rent", icon: CheckCircle2, tone: "green" },
    { label: "On rent", value: String(metrics.onRentCars), note: "With customers", icon: CalendarDays, tone: "blue" },
    { label: "Returning today", value: String(metrics.returningToday), note: metrics.returningToday ? "Due today" : "Nothing due today", icon: Clock3, tone: "amber" },
    { label: "Overdue", value: String(metrics.overdue), note: metrics.overdue ? "Follow up now" : "No overdue rentals", icon: AlertTriangle, tone: "red" },
    { label: "Pending payments", value: money(metrics.outstanding), note: `Across ${metrics.outstandingRentals} rentals`, icon: IndianRupee, tone: "money" },
  ];
  return <>
    <PageHeading eyebrow={dateLabel} title="Good morning, Admin" description="Here’s what needs your attention today." action={<button className="mobile-new" onClick={openNew}><Plus size={16} />New rental</button>} />
    <section className="ai-brief-card">
      <div className="ai-glow ai-glow-one" /><div className="ai-glow ai-glow-two" />
      <div className="ai-brief-top"><span><Sparkles size={14} />Smart briefing</span><i>Live</i></div>
      <h2>{metrics.overdue ? `${metrics.overdue} rental${metrics.overdue === 1 ? " needs" : "s need"} attention.` : "Your fleet is moving smoothly."}</h2>
      <p>{metrics.availableCars} car{metrics.availableCars === 1 ? " is" : "s are"} ready to rent. {metrics.returningToday ? `${metrics.returningToday} return${metrics.returningToday === 1 ? " is" : "s are"} due today.` : "No returns are due today."}</p>
      <div className="ai-brief-insights"><span><b>{money(metrics.outstanding)}</b><small>to collect</small></span><span><b>{metrics.availableCars}</b><small>cars ready</small></span><span><b>{metrics.overdue}</b><small>urgent task{metrics.overdue === 1 ? "" : "s"}</small></span></div>
      <button disabled={!focus} onClick={() => focus && openRental(focus)}>Review today’s focus <ArrowRight size={15} /></button>
    </section>
    <section className="stats-grid" aria-label="Fleet summary">{stats.map((stat) => { const Icon = stat.icon; return <article className={`stat-card ${stat.tone}`} key={stat.label}><div className="stat-top"><span>{stat.label}</span><i><Icon size={15} /></i></div><strong>{stat.value}</strong><small>{stat.note}</small></article>; })}</section>
    <section className="attention-card"><div className="attention-icon"><AlertTriangle size={18} /></div><div><strong>{reminders.length} item{reminders.length === 1 ? "" : "s"} need your attention</strong><p>{reminders[0]?.title ?? "No urgent rental issues right now."}</p></div><button disabled={!focus} onClick={() => focus && openRental(focus)}>Review now <ArrowRight size={14} /></button></section>
    <div className="dashboard-layout">
      <section className="rentals-section">
        <div className="section-title"><div><h2>Current rentals</h2><p>{active.length} vehicle{active.length === 1 ? " is" : "s are"} currently with customers</p></div><button onClick={() => goTo("rentals")}>View all <ArrowRight size={14} /></button></div>
        <div className="rental-stack">{active.slice(0, 3).map((rental) => <RentalCard rental={rental} key={rental.id} open={() => openRental(rental)} sendWhatsApp={() => sendWhatsApp(rental)} />)}</div>
      </section>
      <aside className="dashboard-side">
        <section className="side-card">
          <div className="side-card-title"><div><h3>Reminders</h3><span>{reminders.length} active</span></div><button aria-label="Reminder settings" onClick={() => window.alert("Reminders are generated automatically from live rentals, balances, maintenance and document dates.")}><SlidersHorizontal size={15} /></button></div>
          {reminders.slice(0, 3).map((reminder) => <Reminder key={reminder.key} tone={reminder.tone} icon={reminderIcon(reminder.type)} title={reminder.title} text={reminder.text} action={reminder.rentalId ? () => { const rental = rentals.find((item) => item.id === reminder.rentalId); if (rental) openRental(rental); } : undefined} />)}
          <button className="full-link" onClick={() => window.alert(reminders.length ? reminders.map((item) => `${item.title} — ${item.text}`).join("\n") : "No active reminders.")}>View all reminders <ChevronRight size={15} /></button>
        </section>
        <section className="side-card money-snapshot">
          <div className="side-card-title"><div><h3>Today’s money</h3><span>Live snapshot</span></div><span className="round-icon"><WalletCards size={16} /></span></div>
          <div className="money-line"><span>Collected</span><strong>{money(metrics.collectedToday)}</strong></div><div className="money-line"><span>Expenses</span><strong className="negative">− {money(metrics.expensesToday)}</strong></div><div className="net-line"><span>Net today</span><strong>{money(metrics.netToday)}</strong></div>
          <button className="full-link" onClick={() => goTo("accounts")}>Open accounts <ChevronRight size={15} /></button>
        </section>
      </aside>
    </div>
  </>;
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

function Reminder({ tone, icon: Icon, title, text, action }: { tone: string; icon: LucideIcon; title: string; text: string; action?: () => void }) {
  return <button className={`reminder ${tone}`} onClick={action}><span><Icon size={15} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15} /></button>;
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

function VehiclesView({ vehicles, metrics, openNew, addVehicle, openVehicle, showToast }: { vehicles: Vehicle[]; metrics: Metrics; openNew: () => void; addVehicle: () => void; openVehicle: (vehicle: Vehicle) => void; showToast: (message: string) => void }) {
  const [filter, setFilter] = useState("All vehicles");
  const [textFilter, setTextFilter] = useState("");
  const shown = vehicles.filter((vehicle) => {
    const matchesStatus = filter === "All vehicles" || (filter === "Rented" ? ["rented", "today", "overdue"].includes(vehicle.statusKey) : vehicle.statusKey === filter.toLowerCase());
    const q = textFilter.trim().toLowerCase();
    return matchesStatus && (!q || `${vehicle.name} ${vehicle.make} ${vehicle.plate} ${vehicle.fuel} ${vehicle.transmission}`.toLowerCase().includes(q));
  });
  return <>
    <PageHeading eyebrow="FLEET" title="Vehicles" description="Your full fleet, availability and document health in one place." action={<div className="heading-actions"><button className="secondary-button" onClick={addVehicle}><Plus size={16} />Add vehicle</button><button className="primary-button" onClick={openNew}><CalendarDays size={16} />Rent a car</button></div>} />
    <section className="fleet-strip"><div><span className="strip-icon"><CarFront size={19} /></span><p><strong>{metrics.totalCars} vehicles</strong><small>Total fleet</small></p></div><div><i className="dot available" /><p><strong>{metrics.availableCars} available</strong><small>{metrics.totalCars ? Math.round((metrics.availableCars / metrics.totalCars) * 100) : 0}% of fleet</small></p></div><div><i className="dot rented" /><p><strong>{metrics.onRentCars} on rent</strong><small>{metrics.overdue ? `${metrics.overdue} overdue` : "No overdue rentals"}</small></p></div><div><i className="dot maintenance" /><p><strong>{metrics.maintenanceCars} in service</strong><small>Maintenance status</small></p></div><span className="fleet-progress"><i style={{ width: `${metrics.roadReadyPercent}%` }} /></span></section>
    <div className="panel-toolbar vehicle-toolbar"><div className="filter-tabs">{["All vehicles", "Available", "Rented", "Maintenance"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button" onClick={() => setTextFilter(window.prompt("Filter by vehicle, make, plate, fuel or transmission", textFilter) ?? textFilter)}><SlidersHorizontal size={15} />More filters</button></div>
    <section className="vehicle-grid">{shown.map((vehicle) => <article className="vehicle-card" key={vehicle.id}><div className="vehicle-photo"><img src={vehicle.image} alt={`${vehicle.name} vehicle`} /><span className={`vehicle-status ${vehicle.statusKey}`}><i />{vehicle.status}</span><button aria-label={`More options for ${vehicle.name}`} onClick={() => showToast(`${vehicle.name} · ${vehicle.plate} · ${vehicle.odometer}`)}><MoreHorizontal size={17} /></button></div><div className="vehicle-card-body"><div className="vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.plate}</p></div><strong>{money(vehicle.rate)}<small>/ day</small></strong></div><div className="spec-row"><span><Fuel size={14} />{vehicle.fuel}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.year}</span></div><div className="odometer"><span><Gauge size={15} />Odometer</span><strong>{vehicle.odometer}</strong></div><div className={`document-note ${vehicle.statusKey === "overdue" || vehicle.statusKey === "today" ? "warning" : ""}`}><ShieldCheck size={14} /><span><strong>{vehicle.note}</strong><small>{vehicle.docs}</small></span></div><div className="vehicle-actions"><button onClick={() => openVehicle(vehicle)}>View vehicle</button><button onClick={openNew} disabled={vehicle.statusKey !== "available"}>{vehicle.statusKey === "available" ? "Rent now" : "Unavailable"}</button></div></div></article>)}</section>
  </>;
}

function CustomersView({ customers, metrics, openNew, openRentalById, addCustomer }: { customers: CustomerRow[]; metrics: Metrics; openNew: () => void; openRentalById: (rentalId: string) => void; addCustomer: () => void }) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const shown = customers.filter((customer) => {
    const q = search.trim().toLowerCase(); const city = cityFilter.trim().toLowerCase();
    return (!q || `${customer.name} ${customer.phone}`.toLowerCase().includes(q)) && (!city || customer.city.toLowerCase().includes(city));
  });
  return <>
    <PageHeading eyebrow="CUSTOMER DIRECTORY" title="Customers" description="Rental history, documents and balances—without duplicate records." action={<button className="primary-button" onClick={addCustomer}><UserRoundPlus size={17} />Add customer</button>} />
    <section className="customer-summary"><article><UsersRound size={20} /><div><strong>{metrics.totalCustomers}</strong><span>Total customers</span></div><small><TrendingUp size={13} /> {metrics.newCustomersThisMonth} this month</small></article><article><CalendarDays size={20} /><div><strong>{metrics.currentlyRentingCustomers}</strong><span>Currently renting</span></div><small>{metrics.totalCustomers ? Math.round((metrics.currentlyRentingCustomers / metrics.totalCustomers) * 100) : 0}% of customers</small></article><article><IndianRupee size={20} /><div><strong>{money(metrics.outstanding)}</strong><span>Pending balance</span></div><small className="warn"><AlertTriangle size={13} /> {metrics.outstandingCustomers} customers</small></article></section>
    <section className="data-panel customer-panel"><div className="panel-toolbar"><label className="panel-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" placeholder="Search name or mobile number" /></label><button className="filter-button" onClick={() => setCityFilter(window.prompt("Filter by city. Leave blank for all.", cityFilter) ?? cityFilter)}><SlidersHorizontal size={15} />Filters</button></div><div className="customer-list"><div className="customer-list-head"><span>Customer</span><span>Driving licence</span><span>Rental activity</span><span>Amount spent</span><span>Balance</span><span /></div>{shown.map((customer) => <article className="customer-list-row" key={customer.id}><span className="customer-identity"><i>{customer.initials}</i><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.city}</small></span></span><span><strong>{customer.licence || "Not recorded"}</strong><small>{customer.licence ? "Recorded" : "Optional"}</small></span><span><strong>{customer.rentals} rentals</strong><small>{customer.active ? `Active: ${customer.active}` : "No active rental"}</small></span><span><strong>{money(customer.spent)}</strong><small>Lifetime value</small></span><span><strong className={customer.pending ? "red-text" : "green-text"}>{money(customer.pending)}</strong><small>{customer.pending ? "Pending" : "Fully paid"}</small></span><span className="customer-actions"><button aria-label={`Call ${customer.name}`} onClick={() => { window.location.href = `tel:${customer.phone.replaceAll(" ", "")}`; }}><Phone size={15} /></button><button onClick={() => customer.activeRentalId ? openRentalById(customer.activeRentalId) : openNew()}>{customer.active ? "View rental" : "Rent again"}</button><ChevronRight size={16} /></span></article>)}</div></section>
  </>;
}

function PaymentsView({ rentals, payments, metrics, openPayment, exportPayments, sendWhatsApp }: { rentals: Rental[]; payments: PaymentRow[]; metrics: Metrics; openPayment: () => void; exportPayments: () => void; sendWhatsApp: (rental: Rental, purpose?: string) => void }) {
  const outstanding = [...rentals].filter((rental) => rental.balance > 0).sort((a, b) => b.balance - a.balance);
  return <>
    <PageHeading eyebrow="COLLECTIONS" title="Payments" description="Every receipt and outstanding balance, clearly tracked." action={<button className="primary-button" onClick={openPayment}><Plus size={17} />Receive payment</button>} />
    <section className="payment-summary"><article className="featured"><span>Collected this month</span><strong>{money(metrics.collectedMonth)}</strong><small><TrendingUp size={14} /> {metrics.collectionChangePercent >= 0 ? "+" : ""}{metrics.collectionChangePercent}% vs last month</small></article><article><span>Collected today</span><strong>{money(metrics.collectedToday)}</strong><small>{metrics.paymentsToday} payments</small></article><article><span>Outstanding</span><strong>{money(metrics.outstanding)}</strong><small className="red-text">Across {metrics.outstandingRentals} rentals</small></article><article><span>Security deposits held</span><strong>{money(metrics.depositsHeld)}</strong><small>{metrics.activeRentals} active rentals</small></article></section>
    <div className="payments-layout"><section className="data-panel"><div className="panel-heading"><div><h2>Recent payments</h2><p>Latest customer collections</p></div><button onClick={exportPayments}><Download size={15} />Export</button></div><div className="payments-table"><div className="payments-head"><span>Customer</span><span>Rental</span><span>Date</span><span>Method</span><span>Amount</span></div>{payments.map((payment) => <article key={payment.id}><span><i>{payment.customer.split(" ").map((part) => part[0]).join("")}</i><span><strong>{payment.customer}</strong><small>{payment.id}</small></span></span><span><strong>{payment.rental}</strong><small>Received by {payment.receivedBy}</small></span><span>{payment.date}</span><span><b>{payment.method}</b></span><strong className="green-text">+ {money(payment.amount)}</strong></article>)}</div></section><aside className="outstanding-card"><div className="panel-heading"><div><h2>Outstanding</h2><p>Follow up with {metrics.outstandingCustomers} customers</p></div></div>{outstanding.slice(0,3).map((rental) => <article key={rental.id}><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.vehicle} · {rental.statusText}</small></div><b>{money(rental.balance)}</b><button onClick={() => sendWhatsApp(rental, "payment reminder")} aria-label={`Send reminder to ${rental.customer}`}><Send size={14} /></button></article>)}<button className="full-link" onClick={() => window.alert(outstanding.length ? outstanding.map((rental) => `${rental.customer} · ${rental.id} · ${money(rental.balance)}`).join("\n") : "No outstanding balances.")}>View outstanding report <ChevronRight size={15} /></button></aside></div>
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
  const xml = `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Styles>\n<Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>\n<Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#201A44"/><Alignment ss:Vertical="Center"/></Style>\n<Style ss:ID="Subtitle"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#666B79"/></Style>\n<Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#5B4BDB" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>\n<Style ss:ID="Cell"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="Number"><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="Currency"><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="₹#,##0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E8E9F0"/></Borders></Style>\n<Style ss:ID="TotalLabel"><Font ss:Bold="1"/><Interior ss:Color="#F2F0FF" ss:Pattern="Solid"/></Style>\n<Style ss:ID="TotalValue"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="₹#,##0.00"/><Interior ss:Color="#F2F0FF" ss:Pattern="Solid"/></Style>\n</Styles>\n<Worksheet ss:Name="Report"><Table>\n${widths.map((width) => `<Column ss:Width="${width.toFixed(0)}"/>`).join("\n")}\n<Row ss:Height="30"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Title"><Data ss:Type="String">${xmlEscape(title)}</Data></Cell></Row>\n<Row ss:Height="22"><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Subtitle"><Data ss:Type="String">${xmlEscape(subtitle)}</Data></Cell></Row>\n<Row ss:Height="8"></Row>\n<Row ss:Height="24">${headers.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>\n${rows.map((row) => `<Row ss:Height="21">${cells(row)}</Row>`).join("\n")}\n<Row ss:Height="24"><Cell ss:MergeAcross="${totalMerge}" ss:StyleID="TotalLabel"><Data ss:Type="String">${xmlEscape(totalLabel)}</Data></Cell><Cell ss:StyleID="TotalValue"><Data ss:Type="Number">${total}</Data></Cell></Row>\n</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane></WorksheetOptions></Worksheet>\n</Workbook>`;
  const url = URL.createObjectURL(new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadPdfTable(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  currencyColumns: number[],
  totalLabel: string,
  total: number,
) {
  const pageWidth = 842;
  const pageHeight = 595;
  const margin = 28;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 22;
  const headerHeight = 25;
  const rowsPerPage = 18;
  const sourceRows = rows.length ? rows : [["No matching records"]];
  const pages: (string | number)[][][] = [];
  for (let index = 0; index < sourceRows.length; index += rowsPerPage) pages.push(sourceRows.slice(index, index + rowsPerPage));

  const columnWeights = headers.map((header, columnIndex) => {
    const sampleMax = Math.max(header.length, ...rows.slice(0, 60).map((row) => safeReportText(row[columnIndex] ?? "").length));
    return Math.min(24, Math.max(7, sampleMax));
  });
  const weightTotal = columnWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const columnWidths = columnWeights.map((weight) => tableWidth * weight / weightTotal);
  const pdfEscape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const toPdfY = (top: number) => pageHeight - top;
  const text = (value: string, x: number, top: number, size = 8, bold = false, color = "0.13 0.15 0.18") => `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${toPdfY(top).toFixed(2)} Td (${pdfEscape(value)}) Tj ET`;
  const fillRect = (x: number, top: number, width: number, height: number, color: string) => `${color} rg ${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`;
  const strokeRect = (x: number, top: number, width: number, height: number, color = "0.88 0.89 0.93") => `${color} RG 0.6 w ${x.toFixed(2)} ${(pageHeight - top - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`;
  const fit = (value: string, width: number, size = 7.3) => {
    const maxChars = Math.max(4, Math.floor((width - 8) / (size * 0.52)));
    return value.length > maxChars ? `${value.slice(0, Math.max(1, maxChars - 3))}...` : value;
  };
  const formattedCell = (cell: string | number, columnIndex: number) => typeof cell === "number" && currencyColumns.includes(columnIndex) ? reportCurrency(cell) : safeReportText(cell);

  const contentPages = pages.map((pageRows, pageIndex) => {
    const commands: string[] = [];
    commands.push(fillRect(0, 0, pageWidth, 8, "0.36 0.29 0.86"));
    commands.push(text("MECARDEE RENTAL MANAGER", margin, 34, 8, true, "0.36 0.29 0.86"));
    commands.push(text(safeReportText(title), margin, 57, 18, true));
    commands.push(text(fit(safeReportText(subtitle), 510, 8), margin, 75, 8, false, "0.38 0.40 0.47"));
    const summary = `${safeReportText(totalLabel)}: ${reportCurrency(total)}   |   Rows: ${rows.length}`;
    commands.push(text(summary, 540, 58, 8, true, "0.20 0.24 0.30"));

    const tableTop = 100;
    commands.push(fillRect(margin, tableTop, tableWidth, headerHeight, "0.36 0.29 0.86"));
    let x = margin;
    headers.forEach((header, columnIndex) => {
      const width = columnWidths[columnIndex] ?? 80;
      commands.push(text(fit(safeReportText(header), width, 7.4), x + 5, tableTop + 16, 7.4, true, "1 1 1"));
      x += width;
    });

    pageRows.forEach((row, rowIndex) => {
      const top = tableTop + headerHeight + rowIndex * rowHeight;
      if (rowIndex % 2 === 1) commands.push(fillRect(margin, top, tableWidth, rowHeight, "0.975 0.974 0.995"));
      x = margin;
      headers.forEach((_, columnIndex) => {
        const width = columnWidths[columnIndex] ?? 80;
        commands.push(strokeRect(x, top, width, rowHeight));
        const cell = row[columnIndex] ?? "";
        commands.push(text(fit(formattedCell(cell, columnIndex), width, 7.2), x + 5, top + 14.5, 7.2));
        x += width;
      });
    });

    commands.push(text(`Generated by ${CURRENT_USER_NAME} | Page ${pageIndex + 1} of ${pages.length}`, margin, 574, 7, false, "0.48 0.50 0.56"));
    commands.push(text(new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date()), 670, 574, 7, false, "0.48 0.50 0.56"));
    return commands.join("\n");
  });

  const objects: string[] = [""];
  const pageIds = contentPages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${contentPages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  const encoder = new TextEncoder();
  contentPages.forEach((content, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = new Array(objects.length).fill(0);
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = encoder.encode(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([encoder.encode(pdf)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function ReportsView({ rentals, payments, expenses, vehicles }: { rentals: Rental[]; payments: PaymentRow[]; expenses: ExpenseRow[]; vehicles: Vehicle[] }) {
  const today = dateInputValue(new Date());
  const monthStart = `${today.slice(0, 8)}01`;
  const [reportType, setReportType] = useState<ReportType>("rentals");
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const toggleVehicle = (vehicleId: string) => setSelectedVehicleIds((current) => current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId]);

  const report = useMemo(() => {
    const within = (value: string) => {
      const day = value ? value.slice(0, 10) : "";
      return (!dateFrom || !day || day >= dateFrom) && (!dateTo || !day || day <= dateTo);
    };
    if (reportType === "payments") {
      const filtered = payments.filter((payment) => within(payment.receivedAt));
      return { title: "Payments report", headers: ["Payment", "Customer", "Rental", "Date", "Method", "Amount", "Received by"], rows: filtered.map((payment) => [payment.id, payment.customer, payment.rental, payment.date, payment.method, payment.amount, payment.receivedBy] as (string | number)[]), currencyColumns: [5], total: filtered.reduce((sum, payment) => sum + payment.amount, 0), label: "Collected" };
    }
    if (reportType === "expenses") {
      const filtered = expenses.filter((expense) => within(expense.rawDate));
      return { title: "Expenses report", headers: ["Date", "Category", "Vehicle", "Method", "Amount", "Description"], rows: filtered.map((expense) => [expense.date, expense.category, expense.vehicle, expense.method, expense.amount, expense.description] as (string | number)[]), currencyColumns: [4], total: filtered.reduce((sum, expense) => sum + expense.amount, 0), label: "Expenses" };
    }
    if (reportType === "cars") {
      const chosen = selectedVehicleIds.length ? vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)) : vehicles;
      const chosenIds = new Set(chosen.map((vehicle) => vehicle.id));
      const rentalMap = new Map(rentals.map((rental) => [rental.id, rental]));
      const periodRentals = rentals.filter((rental) => chosenIds.has(rental.vehicleId) && within(rental.startAt));
      const periodPayments = payments.filter((payment) => {
        if (!within(payment.receivedAt)) return false;
        const rental = rentalMap.get(payment.rental);
        return Boolean(rental && chosenIds.has(rental.vehicleId));
      });
      const periodExpenses = expenses.filter((expense) => Boolean(expense.vehicleId && chosenIds.has(expense.vehicleId) && within(expense.rawDate)));
      const rows = chosen.map((vehicle) => {
        const carRentals = periodRentals.filter((rental) => rental.vehicleId === vehicle.id);
        const rentalIds = new Set(rentals.filter((rental) => rental.vehicleId === vehicle.id).map((rental) => rental.id));
        const rentalValue = carRentals.reduce((sum, rental) => sum + rental.total, 0);
        const collected = periodPayments.filter((payment) => rentalIds.has(payment.rental)).reduce((sum, payment) => sum + payment.amount, 0);
        const outstanding = carRentals.reduce((sum, rental) => sum + rental.balance, 0);
        const carExpenses = periodExpenses.filter((expense) => expense.vehicleId === vehicle.id).reduce((sum, expense) => sum + expense.amount, 0);
        return [vehicle.name, vehicle.plate, carRentals.length, rentalValue, collected, outstanding, carExpenses, collected - carExpenses] as (string | number)[];
      });
      return { title: "Car-wise report", headers: ["Vehicle", "Registration", "Rentals", "Rental value", "Collected", "Outstanding", "Expenses", "Net collected"], rows, currencyColumns: [3, 4, 5, 6, 7], total: rows.reduce((sum, row) => sum + Number(row[7] ?? 0), 0), label: "Net collected" };
    }
    const base = rentals.filter((rental) => within(rental.startAt) && (status === "all" || rental.state === status));
    if (reportType === "outstanding") {
      const filtered = base.filter((rental) => rental.balance > 0);
      return { title: "Outstanding balances", headers: ["Rental", "Customer", "Phone", "Vehicle", "Expected return", "Status", "Balance"], rows: filtered.map((rental) => [rental.id, rental.customer, rental.phone, `${rental.vehicle} ${rental.plate}`, rental.returnDate, rental.statusText, rental.balance] as (string | number)[]), currencyColumns: [6], total: filtered.reduce((sum, rental) => sum + rental.balance, 0), label: "Outstanding" };
    }
    return { title: "Rentals report", headers: ["Rental", "Vehicle", "Customer", "Start", "Return", "Status", "Total", "Paid", "Balance"], rows: base.map((rental) => [rental.id, `${rental.vehicle} ${rental.plate}`, rental.customer, rental.start, rental.returnDate, rental.statusText, rental.total, rental.paid, rental.balance] as (string | number)[]), currencyColumns: [6, 7, 8], total: base.reduce((sum, rental) => sum + rental.total, 0), label: "Rental value" };
  }, [reportType, dateFrom, dateTo, status, selectedVehicleIds, rentals, payments, expenses, vehicles]);

  const vehicleScope = selectedVehicleIds.length ? vehicles.filter((vehicle) => selectedVehicleIds.includes(vehicle.id)).map((vehicle) => vehicle.plate).join(", ") : "All cars";
  const subtitle = `${dateFrom || "Any date"} to ${dateTo || "Any date"}${reportType === "rentals" || reportType === "outstanding" ? ` · Status: ${status}` : ""}${reportType === "cars" ? ` · ${vehicleScope}` : ""}`;
  const exportName = `mecardee-${reportType}-${dateFrom || "all"}-${dateTo || "all"}`;

  return <>
    <PageHeading eyebrow="INSIGHTS" title="Reports" description="Live business reports from your rental, payment and expense records." />
    <section className="report-filter-card">
      <div className="report-filter-grid">
        <label className="field"><span>Report</span><select value={reportType} onChange={(event) => setReportType(event.target.value as ReportType)}><option value="rentals">Rentals</option><option value="payments">Payments</option><option value="expenses">Expenses</option><option value="outstanding">Outstanding balances</option><option value="cars">Car-wise report</option></select></label>
        <label className="field"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="field"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {(reportType === "rentals" || reportType === "outstanding") && <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="today">Returning today</option><option value="overdue">Overdue</option><option value="completed">Completed</option></select></label>}
      </div>
      {reportType === "cars" && <div className="car-report-filter"><div><strong>Cars</strong><small>Select one or multiple cars. Leave all unselected to include the full fleet.</small></div><button type="button" className="secondary-button" onClick={() => setSelectedVehicleIds([])}>All cars</button><div className="car-report-options">{vehicles.map((vehicle) => <label key={vehicle.id} className={selectedVehicleIds.includes(vehicle.id) ? "selected" : ""}><input type="checkbox" checked={selectedVehicleIds.includes(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} /><span><strong>{vehicle.name}</strong><small>{vehicle.plate}</small></span></label>)}</div></div>}
      <div className="report-actions"><button className="secondary-button" onClick={() => downloadPdfTable(exportName, report.title, subtitle, report.headers, report.rows, report.currencyColumns, report.label, report.total)} disabled={!report.rows.length}><FileText size={16} />PDF</button><button className="primary-button" onClick={() => downloadExcelTable(exportName, report.title, subtitle, report.headers, report.rows, report.currencyColumns, report.label, report.total)} disabled={!report.rows.length}><Download size={16} />Excel</button></div>
    </section>
    <section className="report-summary"><article><span>Rows</span><strong>{report.rows.length}</strong><small>{subtitle}</small></article><article><span>{report.label}</span><strong>{money(report.total)}</strong><small>Based on current filters</small></article></section>
    <section className="data-panel report-results"><div className="panel-heading"><div><h2>{report.title}</h2><p>{report.rows.length ? `${report.rows.length} matching records` : "No records match these filters"}</p></div></div><div className="report-table-wrap"><table><thead><tr>{report.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{report.rows.map((row, rowIndex) => <tr key={`${reportType}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{typeof cell === "number" && report.currencyColumns.includes(cellIndex) ? money(cell) : cell}</td>)}</tr>)}</tbody></table></div></section>
  </>;
}

function SettingsView({ lastSyncedAt, syncing, onSync, installAvailable, onInstall, biometricSupported }: { lastSyncedAt: Date | null; syncing: boolean; onSync: () => void; installAvailable: boolean; onInstall: () => void; biometricSupported: boolean }) {
  const syncLabel = lastSyncedAt ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" }).format(lastSyncedAt) : "Not synced yet";
  return <>
    <PageHeading eyebrow="APP" title="Settings" description="App installation, synchronization and future security readiness." />
    <section className="settings-grid">
      <article className="settings-card"><span className="settings-icon"><RefreshCw size={19} /></span><div><h3>Live data sync</h3><p>Last synced: {syncLabel}. The app also refreshes after saves and settlements.</p></div><button className="secondary-button" onClick={onSync} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "Syncing…" : "Sync now"}</button></article>
      <article className="settings-card"><span className="settings-icon"><Download size={19} /></span><div><h3>Install Mecardee</h3><p>Android can install this website as a standalone app when the browser offers installation.</p></div><button className="primary-button" onClick={onInstall} disabled={!installAvailable}><Download size={15} />{installAvailable ? "Install app" : "Install not currently offered"}</button></article>
      <article className="settings-card"><span className="settings-icon"><ShieldCheck size={19} /></span><div><h3>Face ID / device biometrics</h3><p>{biometricSupported ? "This device supports the browser security technology needed for passkeys/biometrics." : "Biometric/passkey support was not detected in this browser."} Login is not enabled yet, so Face ID is intentionally not active.</p></div><span className="settings-status">Ready for future authentication</span></article>
      <article className="settings-card"><span className="settings-icon"><FileText size={19} /></span><div><h3>Reports & exports</h3><p>PDF and Excel exports are generated on your device from the filtered live data already loaded in Mecardee.</p></div><span className="settings-status">No extra API required</span></article>
    </section>
  </>;
}

function InstallAppPrompt({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  return <aside className="install-app-prompt" role="dialog" aria-label="Install Mecardee app"><span className="brand-mark">M</span><div><strong>Install Mecardee</strong><small>Add it to your Android home screen for an app-like experience.</small></div><button className="install-now" onClick={onInstall}>Install</button><button className="install-close" onClick={onClose} aria-label="Dismiss install prompt"><X size={16} /></button></aside>;
}

function expenseIcon(category: string): LucideIcon {
  const value = category.toLowerCase();
  if (value.includes("service") || value.includes("repair")) return Wrench;
  if (value.includes("clean")) return Sparkles;
  if (value.includes("insurance")) return ShieldCheck;
  if (value.includes("fuel")) return Fuel;
  return FileText;
}

function AccountsView({ expenses, metrics, openExpense }: { expenses: ExpenseRow[]; metrics: Metrics; openExpense: () => void }) {
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const chart = metrics.monthlyCollected.length ? metrics.monthlyCollected : Array.from({ length: 12 }, (_, index) => ({ key: String(index), label: "—", amount: 0 }));
  const max = Math.max(1, ...chart.map((item) => item.amount));
  const year = metrics.monthlyCollected.at(-1)?.key.slice(0, 4) ?? new Date().getFullYear();
  const shownExpenses = showAllExpenses ? expenses : expenses.slice(0, 12);
  return <>
    <PageHeading eyebrow="MONEY & ACCOUNTS" title="Business overview" description="Simple income and expenses—only what you need to run the day." action={<button className="primary-button" onClick={openExpense}><Plus size={17} />Add expense</button>} />
    <section className="accounts-summary"><article><span>Rental revenue</span><strong>{money(metrics.rentalRevenueMonth)}</strong><small className="green-text"><TrendingUp size={13} /> Current month</small></article><article><span>Amount collected</span><strong>{money(metrics.collectedMonth)}</strong><small>{metrics.rentalRevenueMonth ? Math.round((metrics.collectedMonth / metrics.rentalRevenueMonth) * 1000) / 10 : 0}% collection rate</small></article><article><span>Pending amount</span><strong>{money(metrics.outstanding)}</strong><small className="red-text">{metrics.outstandingRentals} open balances</small></article><article><span>Total expenses</span><strong>{money(metrics.expensesMonth)}</strong><small>Recorded this month</small></article><article className="net"><span>Approx. net income</span><strong>{money(metrics.netIncomeMonth)}</strong><small>Collected income less recorded expenses</small></article></section>
    <div className="accounts-layout"><section className="data-panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Income collected over the last 12 months</p></div><button>{year} <ChevronDown size={14} /></button></div><div className="chart-total"><span>Total collected</span><strong>{money(metrics.twelveMonthCollected)}</strong></div><div className="bar-chart">{chart.map((item, index) => <div key={item.key}><span style={{ height: `${Math.max(4, Math.round((item.amount / max) * 100))}%` }} className={index === chart.length - 1 ? "current" : ""} /><small>{item.label}</small></div>)}</div></section><section className="data-panel expense-panel"><div className="panel-heading"><div><h2>{showAllExpenses ? "All expenses" : "Recent expenses"}</h2><p>{showAllExpenses ? `${expenses.length} recorded expenses` : `${money(metrics.expensesMonth)} recorded this month`}</p></div><button onClick={openExpense}><Plus size={15} />Add</button></div><div className="expense-list">{shownExpenses.map((expense) => { const Icon = expenseIcon(expense.category); return <article key={expense.id}><span className="expense-icon"><Icon size={16} /></span><div><strong>{expense.category}</strong><small>{expense.description || "No description"}{expense.vehicle ? ` · ${expense.vehicle}` : ""}</small></div><span><strong>− {money(expense.amount)}</strong><small>{expense.date} · {expense.method}</small></span></article>; })}</div>{expenses.length > 12 && <button className="full-link" onClick={() => setShowAllExpenses((value) => !value)}>{showAllExpenses ? "Show recent expenses" : `View all ${expenses.length} expenses`} <ChevronRight size={15} /></button>}</section></div>
  </>;
}

function Notifications({ reminders, onClose, openRental }: { reminders: ReminderRow[]; onClose: () => void; openRental: (rentalId: string) => void }) {
  return <div className="notifications-panel"><div className="notification-head"><div><strong>Notifications</strong><span>{reminders.length} new</span></div><button onClick={onClose}><X size={16} /></button></div>{reminders.slice(0,3).map((reminder) => { const Icon = reminderIcon(reminder.type); return <button key={reminder.key} onClick={() => { if (reminder.rentalId) openRental(reminder.rentalId); onClose(); }}><span className={`notice-icon ${reminder.tone === "urgent" ? "urgent" : reminder.type === "payment" ? "payment" : "warning"}`}><Icon size={15} /></span><div><strong>{reminder.title}</strong><small>{reminder.text}</small><time>Live</time></div></button>; })}<div className="notification-footer" onClick={onClose}>Close notifications</div></div>;
}

function MobileNav({ view, goTo, openNew }: { view: View; goTo: (view: View) => void; openNew: () => void }) {
  const items: { view: View; label: string; icon: LucideIcon }[] = [{ view: "dashboard", label: "Home", icon: LayoutDashboard }, { view: "rentals", label: "Rentals", icon: CalendarRange }, { view: "vehicles", label: "Vehicles", icon: CarFront }, { view: "customers", label: "Customers", icon: UsersRound }];
  return <nav className="bottom-nav" aria-label="Mobile navigation">{items.slice(0,2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}<button className="mobile-create" onClick={openNew} aria-label="New rental"><Plus size={23} /></button>{items.slice(2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}</nav>;
}

function MobileMenu({ view, goTo, close }: { view: View; goTo: (view: View) => void; close: () => void }) {
  return <div className="mobile-menu-overlay"><aside><div className="mobile-menu-head"><div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div><button onClick={close}><X size={20} /></button></div><nav>{navItems.map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={18} />{item.label}<ChevronRight size={16} /></button>; })}</nav></aside></div>;
}

function DialogShell({ title, subtitle, close, wide = false, children }: { title: string; subtitle: string; close: () => void; wide?: boolean; children: React.ReactNode }) {
  const keepFocusedFieldVisible = (event: React.FocusEvent<HTMLElement>) => {
    if (window.innerWidth > 720) return;
    const target = event.target as HTMLElement;
    window.setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 180);
  };
  return <div className="dialog-overlay"><section className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onFocusCapture={keepFocusedFieldVisible}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={close} aria-label="Close"><X size={19} /></button></header>{children}</section></div>;
}


function VehicleDialog({ close, done }: { close: () => void; done: (message: string) => void }) {
  const documentTypes = ["Insurance", "Pollution / PUC", "Registration / RC", "Fitness Certificate", "Permit", "Road Tax"];
  const tyrePositions = [["front-left", "Front left"], ["front-right", "Front right"], ["rear-left", "Rear left"], ["rear-right", "Rear right"], ["spare", "Spare"]] as const;
  const [name, setName] = useState(""); const [make, setMake] = useState(""); const [registrationNumber, setRegistrationNumber] = useState("");
  const [fuelType, setFuelType] = useState("Petrol"); const [transmission, setTransmission] = useState("Manual"); const [modelYear, setModelYear] = useState(new Date().getFullYear());
  const [dailyRate, setDailyRate] = useState(1500); const [odometerKm, setOdometerKm] = useState(0); const [allowedKmPerDay, setAllowedKmPerDay] = useState(100); const [extraKmRate, setExtraKmRate] = useState(12); const [mileageKmPerLitre, setMileageKmPerLitre] = useState(15);
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
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/vehicles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), make: make.trim(), registrationNumber: registrationNumber.trim(), fuelType, transmission, modelYear, dailyRate, odometerKm, allowedKmPerDay, extraKmRate, mileageKmPerLitre }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; vehicle?: { id: string } }>(response);
      if (!response.ok || !payload.ok || !payload.vehicle?.id) throw new Error(payload.error ?? "Could not save vehicle.");
      const vehicleId = payload.vehicle.id;
      const tasks: Promise<unknown>[] = [];
      if (imageFile) { const formData = new FormData(); formData.append("file", imageFile); tasks.push(fetch(`/api/vehicles/${vehicleId}/image`, { method: "POST", body: formData }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not upload vehicle image."); })); }
      for (const doc of documents) if (doc.documentNumber || doc.expiryDate || doc.notes) tasks.push(fetch(`/api/vehicles/${vehicleId}/documents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? `Could not save ${doc.documentType}.`); }));
      if (service.description || service.dueDate || service.dueOdometerKm || service.amount) tasks.push(fetch(`/api/vehicles/${vehicleId}/maintenance`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(service) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not save maintenance details."); }));
      for (const tyre of tyres) if (tyre.brand || tyre.model || tyre.size || tyre.installedDate || tyre.installedOdometerKm || tyre.treadDepthMm || tyre.replacementDueDate || tyre.replacementDueOdometerKm || tyre.notes) tasks.push(fetch(`/api/vehicles/${vehicleId}/tyres`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(tyre) }).then(async (r) => { const p = await readApiResponse<{ ok: boolean; error?: string }>(r); if (!r.ok || !p.ok) throw new Error(p.error ?? "Could not save tyre details."); }));
      await Promise.all(tasks);
      done(`${name.trim()} added to fleet`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save vehicle."); }
    finally { setSaving(false); }
  }

  return <DialogShell title="Add vehicle" subtitle="Vehicle, documents, service, tyres and photo" close={close} wide>
    <form className="simple-form" onSubmit={submit}>
      <section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>Vehicle details</h3><p>Main fleet information.</p></div></div><div className="field-grid">
        <label className="field"><span>Vehicle name</span><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Maruti Swift" /></label><label className="field"><span>Make / manufacturer</span><input required value={make} onChange={(e) => setMake(e.target.value)} placeholder="Maruti Suzuki" /></label><label className="field"><span>Registration number</span><input required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} placeholder="KL 35 AB 1234" /></label><label className="field"><span>Model year</span><input required min="1980" max="2100" type="number" value={modelYear} onChange={(e) => setModelYear(Number(e.target.value))} /></label><label className="field"><span>Fuel type</span><select value={fuelType} onChange={(e) => setFuelType(e.target.value)}><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option><option>CNG</option></select></label><label className="field"><span>Transmission</span><select value={transmission} onChange={(e) => setTransmission(e.target.value)}><option>Manual</option><option>Automatic</option></select></label><label className="field"><span>Daily rental rate (₹)</span><input required min="1" type="number" value={dailyRate} onChange={(e) => setDailyRate(Number(e.target.value))} /></label><label className="field"><span>Current odometer (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(odometerKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(e) => setOdometerKm(numberFromInput(e.target.value))} /></label><label className="field"><span>Allowed KM / day</span><input required min="1" type="number" value={allowedKmPerDay} onChange={(e) => setAllowedKmPerDay(Number(e.target.value))} /></label><label className="field"><span>Extra KM rate (₹)</span><input required min="0" step="0.01" type="number" value={extraKmRate} onChange={(e) => setExtraKmRate(Number(e.target.value))} /></label><label className="field"><span>Mileage (KM/L)</span><input required min="0.1" step="0.1" type="number" value={mileageKmPerLitre} onChange={(e) => setMileageKmPerLitre(Number(e.target.value))} /></label><label className="field"><span>Vehicle image</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={processingImage} onChange={(e) => void chooseImage(e.target.files?.[0] ?? null)} /><small>{processingImage ? "Compressing image…" : "Automatically resized/compressed for fast mobile upload"}</small></label>{imagePreview && <div className="field"><span>Preview</span><img src={imagePreview} alt="Vehicle preview" style={{ width:"100%",height:120,objectFit:"cover",borderRadius:14,border:"1px solid #e5e7eb" }} /></div>}
      </div></section>

      <details><summary><strong>Documents</strong> — Insurance, pollution, RC, fitness, permit and tax</summary><div className="field-grid" style={{marginTop:12}}>{documents.map((doc,index)=><div key={doc.documentType} className="field" style={{border:"1px solid #e5e7eb",borderRadius:12,padding:10}}><strong>{doc.documentType}</strong><input placeholder="Document number" value={doc.documentNumber} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,documentNumber:e.target.value}:d))}/><input type="date" value={doc.expiryDate} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,expiryDate:e.target.value}:d))}/><input placeholder="Notes" value={doc.notes} onChange={(e)=>setDocuments(x=>x.map((d,i)=>i===index?{...d,notes:e.target.value}:d))}/></div>)}</div></details>
      <details><summary><strong>Maintenance / service</strong></summary><div className="field-grid" style={{marginTop:12}}><label className="field"><span>Service title</span><input value={service.title} onChange={(e)=>setService({...service,title:e.target.value})}/></label><label className="field"><span>Due date</span><input type="date" value={service.dueDate} onChange={(e)=>setService({...service,dueDate:e.target.value})}/></label><label className="field"><span>Due odometer</span><input type="number" value={service.dueOdometerKm} onChange={(e)=>setService({...service,dueOdometerKm:e.target.value})}/></label><label className="field"><span>Estimated amount</span><input type="number" value={service.amount} onChange={(e)=>setService({...service,amount:e.target.value})}/></label><label className="field"><span>Notes</span><input value={service.description} onChange={(e)=>setService({...service,description:e.target.value})}/></label></div></details>
      <details><summary><strong>Tyres</strong> — current tyre information</summary><div className="field-grid" style={{marginTop:12}}>{tyres.map((tyre,index)=>{const label=tyrePositions.find(([p])=>p===tyre.position)?.[1]??tyre.position;return <div key={tyre.position} className="field" style={{border:"1px solid #e5e7eb",borderRadius:12,padding:10}}><strong>{label}</strong><input placeholder="Brand" value={tyre.brand} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,brand:e.target.value}:t))}/><input placeholder="Model" value={tyre.model} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,model:e.target.value}:t))}/><input placeholder="Size e.g. 195/55 R16" value={tyre.size} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,size:e.target.value}:t))}/><input type="number" placeholder="Replace by KM" value={tyre.replacementDueOdometerKm} onChange={(e)=>setTyres(x=>x.map((t,i)=>i===index?{...t,replacementDueOdometerKm:e.target.value}:t))}/></div>})}</div></details>
      {error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || processingImage}><Check size={16}/>{saving ? "Saving…" : "Add vehicle"}</button></div>
    </form>
  </DialogShell>;
}

function CustomerDialog({ close, done }: { close: () => void; done: (message: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [drivingLicence, setDrivingLicence] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, whatsappNumber, drivingLicence, city }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(payload.error ?? "Could not save customer.");
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

function NewRentalDialog({ vehicles, customers, close, done, showToast }: { vehicles: Vehicle[]; customers: CustomerRow[]; close: () => void; done: (message: string, plate: string) => void; showToast: (message: string) => void }) {
  const availableVehicles = vehicles.filter((item) => item.statusKey === "available");
  const firstVehicle = availableVehicles[0] ?? null;
  const firstCustomer = customers[0] ?? null;
  const [vehicle, setVehicle] = useState(firstVehicle ? `${firstVehicle.name} — ${firstVehicle.plate}` : "");
  const [customerPhone, setCustomerPhone] = useState(firstCustomer?.phone ?? "");
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date()));
  const [returnDate, setReturnDate] = useState(() => dateInputValue(new Date(Date.now() + 5 * 86_400_000)));
  const [startTime, setStartTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("10:00");
  const [rate, setRate] = useState(firstVehicle?.rate ?? 0);
  const [advance, setAdvance] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [startingKilometer, setStartingKilometer] = useState(firstVehicle?.odometerKm ?? 0);
  const [startingFuelRangeKm, setStartingFuelRangeKm] = useState(100);
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
  const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(startDate).getTime()) / 86_400_000));
  const rentalAmount = days * rate;
  const total = Math.max(0, rentalAmount - discount);
  const selectedVehicle = vehicles.find((item) => vehicle.includes(item.plate)) ?? firstVehicle;
  const selectedCustomer = customers.find((item) => item.phone === customerPhone) ?? (createdCustomer?.phone === customerPhone ? { name: createdCustomer.name } : null);
  const expectedReturnKilometer = selectedVehicle
    ? calculateExpectedReturnKilometer(startingKilometer, days, selectedVehicle.allowedKmPerDay)
    : startingKilometer;

  async function saveRental(mode: "rented" | "draft") {
    if (!selectedVehicle) return setError("Add an available vehicle before creating a rental.");
    if (!customerPhone) return setError("Add or select a customer before creating a rental.");
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicleRegistration: selectedVehicle.plate,
          customerPhone,
          startAt: new Date(`${startDate}T${startTime}:00+05:30`).toISOString(),
          endAt: new Date(`${returnDate}T${returnTime}:00+05:30`).toISOString(),
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
      const payload = await readApiResponse<{ ok: boolean; error?: string; rental?: { bookingNumber: string; mode?: string } }>(response);
      if (!response.ok || !payload.rental) throw new Error(payload.error ?? "Could not save the rental.");
      const action = mode === "draft" ? "draft saved" : "created";
      done(`${selectedVehicle.name} rental ${payload.rental.bookingNumber} ${action} for ${selectedCustomer?.name ?? customerPhone}`, selectedVehicle.plate);
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
    setSavingCustomer(true); setError(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName,
          phone: newCustomerPhone,
          whatsappNumber: newCustomerWhatsapp,
          drivingLicence: newCustomerLicence,
          city: newCustomerCity,
        }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { name: string; phone: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(payload.error ?? "Could not save customer.");
      setCreatedCustomer(payload.customer);
      setCustomerPhone(payload.customer.phone);
      setShowCustomerForm(false);
      showToast(`${payload.customer.name} added and selected`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save customer.");
    } finally { setSavingCustomer(false); }
  }


  return <DialogShell title="Create a new rental" subtitle="Vehicle → Customer → Rental details" close={close} wide>
    <div className="stepper"><span className="done"><i><Check size={13} /></i>Vehicle</span><b /><span className="active"><i>2</i>Customer & dates</span><b /><span><i>3</i>Handover</span></div>
    <form className="rental-form" onSubmit={submit}>
      <div className="form-content"><section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>Vehicle and customer</h3><p>Only available vehicles can be selected.</p></div></div><div className="field-grid"><label className="field span-2"><span>Vehicle</span><select value={vehicle} onChange={(event) => { const next = vehicles.find((item) => event.target.value.includes(item.plate)); setVehicle(event.target.value); if (next) { setRate(next.rate); setStartingKilometer(next.odometerKm); } }} disabled={!availableVehicles.length}>{availableVehicles.length ? availableVehicles.map((item) => <option key={item.id}>{item.name} — {item.plate}</option>) : <option>No available vehicles</option>}</select></label><label className="field"><span>Customer</span><select value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} disabled={!customers.length && !createdCustomer}>{createdCustomer && !customers.some((item) => item.phone === createdCustomer.phone) && <option value={createdCustomer.phone}>{createdCustomer.name}</option>}{customers.length ? customers.map((item) => <option key={item.id} value={item.phone}>{item.name}</option>) : !createdCustomer && <option value="">No customers</option>}</select></label><button type="button" className="new-customer" onClick={() => setShowCustomerForm((open) => !open)}><UserRoundPlus size={16} />{showCustomerForm ? "Close customer form" : "Add new customer"}</button></div></section>
        {showCustomerForm && <section className="form-section"><div className="form-section-title"><span><UserRoundPlus size={17} /></span><div><h3>Add new customer</h3><p>Save once and the customer is selected for this rental.</p></div></div><div className="simple-form"><div className="field-grid"><label className="field"><span>Customer name</span><input required value={newCustomerName} onChange={(e)=>setNewCustomerName(e.target.value)} /></label><label className="field"><span>Phone</span><input required inputMode="tel" value={newCustomerPhone} onChange={(e)=>setNewCustomerPhone(e.target.value)} /></label><label className="field"><span>WhatsApp</span><input inputMode="tel" value={newCustomerWhatsapp} onChange={(e)=>setNewCustomerWhatsapp(e.target.value)} placeholder="Leave blank to use phone" /></label><label className="field"><span>Driving licence (optional)</span><input value={newCustomerLicence} onChange={(e)=>setNewCustomerLicence(e.target.value.toUpperCase())} placeholder="Optional" /></label><label className="field span-2"><span>City / place</span><input value={newCustomerCity} onChange={(e)=>setNewCustomerCity(e.target.value)} /></label></div><div className="form-actions"><button type="button" onClick={()=>setShowCustomerForm(false)}>Cancel</button><button type="button" className="primary-button" disabled={savingCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()} onClick={() => void addCustomerHere()}>{savingCustomer?"Saving…":"Save customer"}</button></div></div></section>}
        <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Duration and price update automatically.</p></div></div><div className="field-grid four"><label className="field"><span>Start date</span><input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="field"><span>Start time</span><input required type="time" value={startTime} onChange={(event) => { const next = event.target.value; setReturnTime((current) => current === startTime ? next : current); setStartTime(next); }} /></label><label className="field"><span>Expected return</span><input required type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label><label className="field"><span>Return time</span><input required type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label></div><div className="duration-note"><CalendarRange size={16} /><strong>{days} rental days</strong><span>{startDate} → {returnDate}</span></div></section>
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Vehicle handover</h3><p>Expected return kilometer updates automatically.</p></div></div><div className="field-grid three"><label className="field"><span>Current / Starting Kilometer</span><input required min="0" type="number" placeholder="0" value={blankZero(startingKilometer)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setStartingKilometer(numberFromInput(event.target.value))} /></label><label className="field"><span>Allowed KM Per Day</span><input readOnly value={`${selectedVehicle?.allowedKmPerDay ?? 0} km`} /></label><label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Starting Fuel Range (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(startingFuelRangeKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setStartingFuelRangeKm(numberFromInput(event.target.value))} /></label></div></section>
        <section className="form-section"><div className="form-section-title"><span><WalletCards size={17} /></span><div><h3>Payment details</h3><p>Record the advance and deposit received.</p></div></div><div className="field-grid three"><label className="field"><span>Daily rate (₹)</span><input required min="0" type="number" placeholder="0" value={blankZero(rate)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setRate(numberFromInput(event.target.value))} /></label><label className="field"><span>Security deposit (₹)</span><input min="0" type="number" inputMode="decimal" placeholder="0" value={blankZero(deposit)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDeposit(numberFromInput(event.target.value))} /></label><label className="field"><span>Advance paid (₹)</span><input min="0" max={total} type="number" inputMode="decimal" placeholder="0" value={blankZero(advance)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setAdvance(numberFromInput(event.target.value))} /></label><label className="field"><span>Discount (₹)</span><input min="0" max={rentalAmount} type="number" placeholder="0" value={blankZero(discount)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDiscount(numberFromInput(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div></section>
      </div>
      <footer className="rental-submit-footer">
        {error && <p className="form-error">{error}</p>}
        <div className="rental-submit-actions">
          <button className="confirm-rental" type="submit" disabled={saving || !selectedVehicle || !customerPhone}>{saving ? "Saving…" : "Confirm rental"} {!saving && <ArrowRight size={16} />}</button>
          <button className="save-draft" type="button" disabled={saving || !selectedVehicle || !customerPhone} onClick={() => void saveRental("draft")}>{saving ? "Saving…" : "Save as draft"}</button>
        </div>
      </footer>
    </form>
  </DialogShell>;
}

function RentalDetailDialog({ rental, close, switchDialog, sendWhatsApp }: { rental: Rental; close: () => void; switchDialog: (dialog: DialogType) => void; sendWhatsApp: (rental: Rental, purpose?: string) => void }) {
  const collectedPercent = rental.total > 0 ? Math.min(100, Math.round((rental.paid / rental.total) * 100)) : 100;
  return <DialogShell title={rental.id} subtitle={`${rental.vehicle} · ${rental.plate}`} close={close} wide>
    <div className="detail-hero"><img src={rental.image} alt={`${rental.vehicle} vehicle`} /><div><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span><h2>{rental.vehicle}</h2><p>{rental.plate}</p></div><div className="detail-contact"><a href={`tel:${rental.phone.replaceAll(" ", "")}`}><Phone size={16} />Call</a><button onClick={() => sendWhatsApp(rental, "rental reminder")}><MessageCircle size={16} />WhatsApp</button></div></div>
    <div className="detail-layout"><div className="detail-main"><section className="detail-section"><div className="detail-title"><span><UserRound size={17} /></span><div><h3>Customer</h3><p>Verified customer details</p></div></div><div className="customer-detail-card"><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.phone}</small></div><div><small>Driving licence</small><strong>{rental.licence || "Not recorded"}</strong></div><ShieldCheck size={18} /></div></section><section className="detail-section"><div className="detail-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Original booking dates</p></div></div><div className="timeline"><div><i /><span><small>Rental started</small><strong>{rental.start}</strong></span></div><b /><div><i /><span><small>Expected return</small><strong>{rental.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Rental days</small><strong>{rental.days} days</strong></div><div><small>Daily rate</small><strong>{money(rental.rate)}</strong></div><div><small>Starting odometer</small><strong>{rental.startingKilometer.toLocaleString("en-IN")} km</strong></div><div><small>Expected return KM</small><strong>{calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay).toLocaleString("en-IN")} km</strong></div><div><small>Fuel range at handover</small><strong>{rental.startingFuelRangeKm} km</strong></div><div><small>Allowed per day</small><strong>{rental.allowedKmPerDay} km</strong></div></div></section></div><aside className="financial-card"><div className="detail-title"><span><ReceiptIndianRupee size={17} /></span><div><h3>Financial summary</h3><p>Updated live</p></div></div><div className="financial-line"><span>Rental amount</span><strong>{money(rental.rentalAmount)}</strong></div><div className="financial-line"><span>Additional charges</span><strong>{money(rental.otherCharges)}</strong></div><div className="financial-line"><span>Discount</span><strong>− {money(rental.bookingDiscount)}</strong></div><div className="financial-total"><span>Total</span><strong>{money(rental.total)}</strong></div><div className="financial-line paid"><span>Amount paid</span><strong>{money(rental.paid)}</strong></div><div className="financial-balance"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><div className="paid-progress"><span style={{ width: `${collectedPercent}%` }} /></div><small className="paid-caption">{collectedPercent}% collected</small><button className="receive-button" onClick={() => switchDialog("payment")} disabled={rental.balance <= 0}><CreditCard size={16} />Receive payment</button></aside></div>
    <footer className="detail-actions"><button onClick={() => switchDialog("extend")}><CalendarRange size={16} />Extend rental</button><button onClick={() => switchDialog("return")} className="return-button"><CarFront size={16} />Return vehicle</button></footer>
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

function ReturnDialog({ rental, close, onConfirmed }: { rental: Rental; close: () => void; onConfirmed: (result: SettlementResult) => void }) {
  const expectedReturnKilometer = calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay);
  const [actualReturnDate, setActualReturnDate] = useState(() => dateInputValue(new Date()));
  const [actualReturnTime, setActualReturnTime] = useState(() => new Date().toTimeString().slice(0, 5));
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
  const lateRental = calculateLateRentalCharge(rental.endAt, actualReturnIso, rental.rate, 3);
  const calculation = calculateSettlement({
    baseRentalAmount: Math.max(0, rental.total - rental.lateRentalCharge),
    rentalDays: rental.days,
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

  async function confirmSettlement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingNumber: rental.id,
          actualReturnAt: actualReturnIso,
          actualReturnKilometer,
          returnFuelRangeKm,
          fuelPricePerLitre,
          cleaningCharge: cleaning,
          damageCharge: damage,
          discountAmount,
          discountRemark,
          returnNotes,
          vehicleCondition,
          sendToMaintenance,
        }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string; settlement?: SettlementResult }>(response);
      if (!response.ok || !payload.settlement) throw new Error(payload.error ?? "Could not confirm the return settlement.");
      setConfirmed(payload.settlement);
      onConfirmed(payload.settlement);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not confirm the return settlement.");
    } finally {
      setSaving(false);
    }
  }

  if (confirmed) {
    return <DialogShell title="Settlement confirmed" subtitle={`${rental.vehicle} · ${rental.plate}`} close={close}>
      <div className="settlement-success"><span><CheckCircle2 size={25} /></span><h3>Return settlement saved</h3><p>{rental.id} is completed and the vehicle is {confirmed.vehicleStatus === "available" ? "available for future bookings" : "marked for maintenance"}.</p><div><small>Final amount</small><strong>{money(confirmed.calculation.finalAmount)}</strong></div><a className="whatsapp-button" href={confirmed.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} />Send Details via WhatsApp</a><small>WhatsApp opens with the message pre-filled. Review it and press Send yourself.</small><button type="button" className="save-draft" onClick={close}>Close</button></div>
    </DialogShell>;
  }

  return <DialogShell title="Return vehicle" subtitle={`${rental.vehicle} · ${rental.plate}`} close={close} wide>
    <form className="return-form" onSubmit={confirmSettlement}>
      <div className="return-fields">
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Return inspection</h3><p>Kilometers and fuel charges calculate automatically.</p></div></div><div className="field-grid three">
          <label className="field"><span>Actual return date</span><input required type="date" value={actualReturnDate} onChange={(event) => setActualReturnDate(event.target.value)} /></label>
          <label className="field"><span>Return time</span><input required type="time" value={actualReturnTime} onChange={(event) => setActualReturnTime(event.target.value)} /></label>
          <label className="field"><span>Actual Return Kilometer</span><input required min={rental.startingKilometer} type="number" placeholder="0" value={blankZero(actualReturnKilometer)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setActualReturnKilometer(numberFromInput(event.target.value))} /></label>
          <label className="field"><span>Starting Kilometer</span><input readOnly value={`${rental.startingKilometer.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Total Allowed Kilometers</span><input readOnly value={`${calculation.allowedKilometers.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Starting Fuel Range (KM)</span><input readOnly value={rental.startingFuelRangeKm} /></label>
          <label className="field"><span>Return Fuel Range (KM)</span><input required min="0" type="number" placeholder="0" value={blankZero(returnFuelRangeKm)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setReturnFuelRangeKm(numberFromInput(event.target.value))} /></label>
          <label className="field"><span>Current Fuel Price Per Litre (₹)</span><input required min="0" step="0.01" type="number" placeholder="0" value={blankZero(fuelPricePerLitre)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setFuelPricePerLitre(numberFromInput(event.target.value))} /></label>
          <label className="field span-2"><span>Vehicle condition</span><select value={vehicleCondition} onChange={(event) => setVehicleCondition(event.target.value)}><option>Good — no new damage</option><option>Minor new damage</option><option>Major damage</option></select></label>
        </div></section>
        <section className="form-section"><div className="form-section-title"><span><IndianRupee size={17} /></span><div><h3>Additional charges</h3><p>Extra KM, fuel shortage and late-day rent are automatic. A 3-hour grace period applies after the expected return time.</p></div></div><div className="charge-grid">
          <label><span>Extra KM ({calculation.extraKilometers} km)</span><input readOnly value={calculation.extraKmCharge} /></label>
          <label><span>Fuel shortage ({calculation.fuelRangeShortageKm} km)</span><input readOnly value={calculation.fuelCharge} /></label>
          <label><span>Late return charge ({lateRental.extraRentalDays} extra day{lateRental.extraRentalDays === 1 ? "" : "s"})</span><input readOnly value={lateRental.charge} /></label>
          <label><span>Cleaning</span><input min="0" type="number" placeholder="0" value={blankZero(cleaning)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setCleaning(numberFromInput(event.target.value))} /></label>
          <label><span>Damage</span><input min="0" type="number" placeholder="0" value={blankZero(damage)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDamage(numberFromInput(event.target.value))} /></label>
        </div><p className="calculation-note">Late rule: 3-hour grace, then each started 24 hours = 1 extra rental day · Fuel needed: {calculation.requiredFuelLitres.toFixed(3)} L · Mileage: {rental.mileageKmPerLitre} km/L · Extra KM rate: {money(rental.extraKmRate)}/km</p><label className="field"><span>Return notes</span><textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Condition, damage or payment notes" /></label></section>
      </div>
      <aside className="final-bill"><h3>Final bill</h3><div><span>Base rental amount</span><strong>{money(Math.max(0, rental.total - rental.lateRentalCharge))}</strong></div><div><span>Extra kilometer charge</span><strong>{money(calculation.extraKmCharge)}</strong></div><div><span>Fuel shortage charge</span><strong>{money(calculation.fuelCharge)}</strong></div><div><span>Late rental charge</span><strong>{money(lateRental.charge)}</strong></div><div><span>Cleaning / damage</span><strong>{money(cleaning + damage)}</strong></div><div className="final-total"><span>Subtotal</span><strong>{money(calculation.subtotal)}</strong></div><label className="field"><span>Discount Amount (optional)</span><input min="0" max={calculation.subtotal} step="0.01" type="number" placeholder="0" value={blankZero(discountAmount)} onFocus={selectZeroOnFocus} onKeyDown={numericKeyOnly} onChange={(event) => setDiscountAmount(numberFromInput(event.target.value))} /></label><label className="field"><span>Discount Remark (optional)</span><input value={discountRemark} onChange={(event) => setDiscountRemark(event.target.value)} placeholder="e.g. Regular Customer" /></label><div className="final-total"><span>Final amount</span><strong>{money(calculation.finalAmount)}</strong></div><div className="paid"><span>Already recorded</span><strong>− {money(rental.paid)}</strong></div><div className="due"><span>Balance due</span><strong>{money(calculation.amountDue)}</strong></div><label className="maintenance-check"><input type="checkbox" checked={sendToMaintenance} onChange={(event) => setSendToMaintenance(event.target.checked)} /><span><Wrench size={16} /><span><strong>Send to maintenance</strong><small>Vehicle will not become available</small></span></span></label>{error && <p className="form-error">{error}</p>}<button type="submit" className="confirm-rental" disabled={saving}>{saving ? "Confirming…" : "Confirm Settlement"} {!saving && <Check size={16} />}</button><button type="button" className="save-draft" onClick={close}>Cancel</button></aside>
    </form>
  </DialogShell>;
}

function ExpenseDialog({ vehicles, close, done }: { vehicles: Vehicle[]; close: () => void; done: (message: string) => void }) {
  const [expenseDate, setExpenseDate] = useState(() => dateInputValue(new Date()));
  const [category, setCategory] = useState("Vehicle service");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expenseDate, category, vehicleRegistration: vehicleRegistration || null, amount, description, method }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; expense?: { expenseNumber: string } }>(response);
      if (!response.ok || !payload.expense) throw new Error(payload.error ?? "Could not save expense.");
      done(`${money(amount)} expense ${payload.expense.expenseNumber} recorded`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Add an expense" subtitle="Record a simple business or vehicle expense" close={close}><form className="simple-form" onSubmit={submit}><div className="field-grid"><label className="field"><span>Date</span><input required type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label><label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Vehicle service</option><option>Repair</option><option>Insurance</option><option>Fuel</option><option>Cleaning</option><option>Office expense</option><option>Other</option></select></label><label className="field"><span>Vehicle (optional)</span><select value={vehicleRegistration} onChange={(event) => setVehicleRegistration(event.target.value)}><option value="">Not vehicle-specific</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.name} · {vehicle.plate}</option>)}</select></label><label className="field"><span>Amount (₹)</span><input required min="0.01" step="0.01" type="number" inputMode="decimal" placeholder="0" value={blankZero(amount)} onKeyDown={numericKeyOnly} onChange={(event) => setAmount(numberFromInput(event.target.value))} /></label></div><label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this expense for?" /></label><label className="field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option></select></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || amount <= 0}><Check size={16} />{saving ? "Saving…" : "Save expense"}</button></div></form></DialogShell>;
}
