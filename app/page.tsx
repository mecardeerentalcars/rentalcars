"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { calculateExpectedReturnKilometer, calculateSettlement } from "@/lib/rental-calculations";
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

type View = "dashboard" | "rentals" | "vehicles" | "customers" | "payments" | "accounts";
type DialogType = null | "new-rental" | "rental-detail" | "payment" | "extend" | "return" | "expense" | "vehicle";
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

type AppSnapshot = { ok: boolean; error?: string; rentals: Rental[]; vehicles: Vehicle[]; customers: CustomerRow[]; payments: PaymentRow[]; expenses: ExpenseRow[]; reminders: ReminderRow[]; metrics: Metrics };

const emptyMetrics: Metrics = { totalCars: 0, availableCars: 0, onRentCars: 0, maintenanceCars: 0, roadReadyPercent: 0, activeRentals: 0, returningToday: 0, overdue: 0, outstanding: 0, outstandingRentals: 0, outstandingCustomers: 0, totalCustomers: 0, newCustomersThisMonth: 0, currentlyRentingCustomers: 0, collectedToday: 0, paymentsToday: 0, expensesToday: 0, netToday: 0, collectedMonth: 0, collectedLastMonth: 0, collectionChangePercent: 0, rentalRevenueMonth: 0, expensesMonth: 0, netIncomeMonth: 0, depositsHeld: 0, twelveMonthCollected: 0, monthlyCollected: [] };

const navItems: { label: string; view: View; icon: LucideIcon; badge?: string }[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Rentals", view: "rentals", icon: CalendarRange, badge: "3" },
  { label: "Vehicles", view: "vehicles", icon: CarFront },
  { label: "Customers", view: "customers", icon: UsersRound },
  { label: "Payments", view: "payments", icon: WalletCards },
  { label: "Accounts", view: "accounts", icon: BarChart3 },
];

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function dateInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

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
  const [customerList, setCustomerList] = useState<CustomerRow[]>([]);
  const [paymentList, setPaymentList] = useState<PaymentRow[]>([]);
  const [expenseList, setExpenseList] = useState<ExpenseRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
      setCustomerList(payload.customers);
      setPaymentList(payload.payments);
      setExpenseList(payload.expenses);
      setReminders(payload.reminders);
      setMetrics(payload.metrics);
      setSelectedRental((current) => current ? payload.rentals.find((rental) => rental.id === current.id) ?? payload.rentals[0] ?? null : payload.rentals[0] ?? null);
    } catch (error) {
      console.error(error);
      showToast(error instanceof Error ? error.message : "Could not load live database data.");
    }
  }, [showToast]);

  useEffect(() => { void refreshData(); }, [refreshData]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const vehicleResults = vehicleList.filter((v) => `${v.name} ${v.plate}`.toLowerCase().includes(query)).map((v) => ({ type: "Vehicle", title: v.name, meta: `${v.plate} · ${v.status}`, action: () => goTo("vehicles") }));
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

  async function addCustomerPrompt() {
    const name = window.prompt("Customer name");
    if (!name?.trim()) return null;
    const phone = window.prompt("Phone number");
    if (!phone?.trim()) return null;
    const drivingLicence = window.prompt("Driving licence number");
    if (!drivingLicence?.trim()) return null;
    const city = window.prompt("City (optional)") ?? "";
    const whatsappNumber = window.prompt("WhatsApp number (leave blank to use phone)") ?? "";
    try {
      const response = await fetch("/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone, drivingLicence, city, whatsappNumber }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; customer?: { phone: string } }>(response);
      if (!response.ok || !payload.customer) throw new Error(payload.error ?? "Could not save customer.");
      await refreshData();
      showToast(`${name.trim()} added to customers`);
      return payload.customer.phone;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save customer.");
      return null;
    }
  }



  function exportPayments() {
    if (!paymentList.length) return showToast("No payments to export.");
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["Payment", "Customer", "Rental", "Date", "Method", "Amount", "Received by"], ...paymentList.map((payment) => [payment.id, payment.customer, payment.rental, payment.date, payment.method, payment.amount, payment.receivedBy])];
    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `mecardee-payments-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
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
          <div className="search-wrap">
            <label className="global-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Global search" placeholder="Search car, customer or rental ID" /><kbd>⌘ K</kbd></label>
            {search && <div className="search-results">
              <div className="search-caption">Search results</div>
              {searchResults.length ? searchResults.map((result, index) => <button key={`${result.type}-${index}`} onClick={result.action}><span className="result-icon">{result.type[0]}</span><span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight size={15} /></button>) : <div className="empty-search"><Search size={20} /><span>No matches for “{search}”</span></div>}
            </div>}
          </div>
          <div className="top-actions">
            <div className="notification-wrap">
              <button className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={18} />{reminders.length > 0 && <span className="notification-dot" />}</button>
              {notificationsOpen && <Notifications reminders={reminders} onClose={() => setNotificationsOpen(false)} openRental={openRentalById} />}
            </div>
            <button className="primary-button" onClick={() => setDialog("new-rental")}><Plus size={17} /> New rental</button>
          </div>
        </header>

        <div className="content">
          {view === "dashboard" && <Dashboard rentals={rentalList} metrics={metrics} reminders={reminders} openRental={openRental} openNew={() => setDialog("new-rental")} goTo={goTo} sendWhatsApp={sendWhatsApp} />}
          {view === "rentals" && <RentalsView rentals={rentalList} metrics={metrics} openRental={openRental} openNew={() => setDialog("new-rental")} />}
          {view === "vehicles" && <VehiclesView vehicles={vehicleList} metrics={metrics} openNew={() => setDialog("new-rental")} addVehicle={() => setDialog("vehicle")} showToast={showToast} />}
          {view === "customers" && <CustomersView customers={customerList} metrics={metrics} openNew={() => setDialog("new-rental")} openRentalById={openRentalById} addCustomer={() => void addCustomerPrompt()} />}
          {view === "payments" && <PaymentsView rentals={rentalList} payments={paymentList} metrics={metrics} openPayment={openPayment} exportPayments={exportPayments} sendWhatsApp={sendWhatsApp} />}
          {view === "accounts" && <AccountsView expenses={expenseList} metrics={metrics} openExpense={() => setDialog("expense")} />}
        </div>
      </main>

      <MobileNav view={view} goTo={goTo} openNew={() => setDialog("new-rental")} />
      {mobileMenuOpen && <MobileMenu view={view} goTo={goTo} close={() => setMobileMenuOpen(false)} />}
      {dialog === "new-rental" && <NewRentalDialog vehicles={vehicleList} customers={customerList} addCustomer={addCustomerPrompt} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} showToast={showToast} />}
      {dialog === "rental-detail" && selectedRental && <RentalDetailDialog rental={selectedRental} close={() => setDialog(null)} switchDialog={setDialog} sendWhatsApp={sendWhatsApp} />}
      {dialog === "payment" && selectedRental && <PaymentDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "extend" && selectedRental && <ExtendDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
      {dialog === "return" && selectedRental && <ReturnDialog rental={selectedRental} close={() => setDialog(null)} onConfirmed={handleSettlementConfirmed} />}
      {dialog === "vehicle" && <VehicleDialog close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); void refreshData(); }} />}
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
      {navItems.map((item) => { const Icon = item.icon; const badge = item.view === "rentals" && metrics.activeRentals > 0 ? String(metrics.activeRentals) : null; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span>{badge && <b>{badge}</b>}</button>; })}
      <span className="nav-label lower">INSIGHTS</span>
      <button className="nav-item"><FileText size={17} /><span>Reports</span></button>
      <button className="nav-item"><Settings2 size={17} /><span>Settings</span></button>
    </nav>
    <div className="sidebar-health"><div className="health-head"><span className="pulse" /><strong>Fleet health</strong><b>{metrics.roadReadyPercent}%</b></div><div className="health-bar"><span style={{ width: `${metrics.roadReadyPercent}%` }} /></div><small>{Math.max(0, metrics.totalCars - metrics.maintenanceCars)} of {metrics.totalCars} vehicles are road-ready</small></div>
    <div className="profile-mini"><span>AK</span><div><strong>Ajmal K.</strong><small>Owner</small></div><MoreHorizontal size={17} /></div>
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
    <PageHeading eyebrow={dateLabel} title="Good morning, Ajmal" description="Here’s what needs your attention today." action={<button className="mobile-new" onClick={openNew}><Plus size={16} />New rental</button>} />
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

function VehiclesView({ vehicles, metrics, openNew, addVehicle, showToast }: { vehicles: Vehicle[]; metrics: Metrics; openNew: () => void; addVehicle: () => void; showToast: (message: string) => void }) {
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
    <section className="vehicle-grid">{shown.map((vehicle) => <article className="vehicle-card" key={vehicle.id}><div className="vehicle-photo"><img src={vehicle.image} alt={`${vehicle.name} vehicle`} /><span className={`vehicle-status ${vehicle.statusKey}`}><i />{vehicle.status}</span><button aria-label={`More options for ${vehicle.name}`} onClick={() => showToast(`${vehicle.name} · ${vehicle.plate} · ${vehicle.odometer}`)}><MoreHorizontal size={17} /></button></div><div className="vehicle-card-body"><div className="vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.plate}</p></div><strong>{money(vehicle.rate)}<small>/ day</small></strong></div><div className="spec-row"><span><Fuel size={14} />{vehicle.fuel}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.year}</span></div><div className="odometer"><span><Gauge size={15} />Odometer</span><strong>{vehicle.odometer}</strong></div><div className={`document-note ${vehicle.statusKey === "overdue" || vehicle.statusKey === "today" ? "warning" : ""}`}><ShieldCheck size={14} /><span><strong>{vehicle.note}</strong><small>{vehicle.docs}</small></span></div><div className="vehicle-actions"><button onClick={() => showToast(`${vehicle.name}: ${vehicle.status} · ${vehicle.docs}`)}>View vehicle</button><button onClick={openNew} disabled={vehicle.statusKey !== "available"}>{vehicle.statusKey === "available" ? "Rent now" : "Unavailable"}</button></div></div></article>)}</section>
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
    <section className="data-panel customer-panel"><div className="panel-toolbar"><label className="panel-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search customers" placeholder="Search name or mobile number" /></label><button className="filter-button" onClick={() => setCityFilter(window.prompt("Filter by city. Leave blank for all.", cityFilter) ?? cityFilter)}><SlidersHorizontal size={15} />Filters</button></div><div className="customer-list"><div className="customer-list-head"><span>Customer</span><span>Driving licence</span><span>Rental activity</span><span>Amount spent</span><span>Balance</span><span /></div>{shown.map((customer) => <article className="customer-list-row" key={customer.id}><span className="customer-identity"><i>{customer.initials}</i><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.city}</small></span></span><span><strong>{customer.licence}</strong><small>Verified</small></span><span><strong>{customer.rentals} rentals</strong><small>{customer.active ? `Active: ${customer.active}` : "No active rental"}</small></span><span><strong>{money(customer.spent)}</strong><small>Lifetime value</small></span><span><strong className={customer.pending ? "red-text" : "green-text"}>{money(customer.pending)}</strong><small>{customer.pending ? "Pending" : "Fully paid"}</small></span><span className="customer-actions"><button aria-label={`Call ${customer.name}`} onClick={() => { window.location.href = `tel:${customer.phone.replaceAll(" ", "")}`; }}><Phone size={15} /></button><button onClick={() => customer.activeRentalId ? openRentalById(customer.activeRentalId) : openNew()}>{customer.active ? "View rental" : "Rent again"}</button><ChevronRight size={16} /></span></article>)}</div></section>
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

function expenseIcon(category: string): LucideIcon {
  const value = category.toLowerCase();
  if (value.includes("service") || value.includes("repair")) return Wrench;
  if (value.includes("clean")) return Sparkles;
  if (value.includes("insurance")) return ShieldCheck;
  if (value.includes("fuel")) return Fuel;
  return FileText;
}

function AccountsView({ expenses, metrics, openExpense }: { expenses: ExpenseRow[]; metrics: Metrics; openExpense: () => void }) {
  const chart = metrics.monthlyCollected.length ? metrics.monthlyCollected : Array.from({ length: 12 }, (_, index) => ({ key: String(index), label: "—", amount: 0 }));
  const max = Math.max(1, ...chart.map((item) => item.amount));
  const year = metrics.monthlyCollected.at(-1)?.key.slice(0, 4) ?? new Date().getFullYear();
  return <>
    <PageHeading eyebrow="MONEY & ACCOUNTS" title="Business overview" description="Simple income and expenses—only what you need to run the day." action={<button className="primary-button" onClick={openExpense}><Plus size={17} />Add expense</button>} />
    <section className="accounts-summary"><article><span>Rental revenue</span><strong>{money(metrics.rentalRevenueMonth)}</strong><small className="green-text"><TrendingUp size={13} /> Current month</small></article><article><span>Amount collected</span><strong>{money(metrics.collectedMonth)}</strong><small>{metrics.rentalRevenueMonth ? Math.round((metrics.collectedMonth / metrics.rentalRevenueMonth) * 1000) / 10 : 0}% collection rate</small></article><article><span>Pending amount</span><strong>{money(metrics.outstanding)}</strong><small className="red-text">{metrics.outstandingRentals} open balances</small></article><article><span>Total expenses</span><strong>{money(metrics.expensesMonth)}</strong><small>Recorded this month</small></article><article className="net"><span>Approx. net income</span><strong>{money(metrics.netIncomeMonth)}</strong><small>Collected income less recorded expenses</small></article></section>
    <div className="accounts-layout"><section className="data-panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Income collected over the last 12 months</p></div><button>{year} <ChevronDown size={14} /></button></div><div className="chart-total"><span>Total collected</span><strong>{money(metrics.twelveMonthCollected)}</strong></div><div className="bar-chart">{chart.map((item, index) => <div key={item.key}><span style={{ height: `${Math.max(4, Math.round((item.amount / max) * 100))}%` }} className={index === chart.length - 1 ? "current" : ""} /><small>{item.label}</small></div>)}</div></section><section className="data-panel expense-panel"><div className="panel-heading"><div><h2>Recent expenses</h2><p>{money(metrics.expensesMonth)} recorded this month</p></div><button onClick={openExpense}><Plus size={15} />Add</button></div><div className="expense-list">{expenses.slice(0, 12).map((expense) => { const Icon = expenseIcon(expense.category); return <article key={expense.id}><span className="expense-icon"><Icon size={16} /></span><div><strong>{expense.category}</strong><small>{expense.description} · {expense.vehicle}</small></div><span><strong>− {money(expense.amount)}</strong><small>{expense.date} · {expense.method}</small></span></article>; })}</div><button className="full-link" onClick={() => window.alert(expenses.length ? expenses.map((expense) => `${expense.date} · ${expense.category} · ${money(expense.amount)}`).join("\n") : "No expenses recorded.")}>View all expenses <ChevronRight size={15} /></button></section></div>
  </>;
}

function Notifications({ reminders, onClose, openRental }: { reminders: ReminderRow[]; onClose: () => void; openRental: (rentalId: string) => void }) {
  return <div className="notifications-panel"><div className="notification-head"><div><strong>Notifications</strong><span>{reminders.length} new</span></div><button onClick={onClose}><X size={16} /></button></div>{reminders.slice(0,3).map((reminder) => { const Icon = reminderIcon(reminder.type); return <button key={reminder.key} onClick={() => reminder.rentalId && openRental(reminder.rentalId)}><span className={`notice-icon ${reminder.tone === "urgent" ? "urgent" : reminder.type === "payment" ? "payment" : "warning"}`}><Icon size={15} /></span><div><strong>{reminder.title}</strong><small>{reminder.text}</small><time>Live</time></div></button>; })}<div className="notification-footer" onClick={onClose}>Close notifications</div></div>;
}

function MobileNav({ view, goTo, openNew }: { view: View; goTo: (view: View) => void; openNew: () => void }) {
  const items: { view: View; label: string; icon: LucideIcon }[] = [{ view: "dashboard", label: "Home", icon: LayoutDashboard }, { view: "rentals", label: "Rentals", icon: CalendarRange }, { view: "vehicles", label: "Vehicles", icon: CarFront }, { view: "customers", label: "Customers", icon: UsersRound }];
  return <nav className="bottom-nav" aria-label="Mobile navigation">{items.slice(0,2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}<button className="mobile-create" onClick={openNew} aria-label="New rental"><Plus size={23} /></button>{items.slice(2).map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={19} />{item.label}</button>; })}</nav>;
}

function MobileMenu({ view, goTo, close }: { view: View; goTo: (view: View) => void; close: () => void }) {
  return <div className="mobile-menu-overlay"><aside><div className="mobile-menu-head"><div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div><button onClick={close}><X size={20} /></button></div><nav>{navItems.map((item) => { const Icon = item.icon; return <button className={view === item.view ? "active" : ""} key={item.view} onClick={() => goTo(item.view)}><Icon size={18} />{item.label}<ChevronRight size={16} /></button>; })}</nav><div className="profile-mini"><span>AK</span><div><strong>Ajmal K.</strong><small>Owner</small></div></div></aside></div>;
}

function DialogShell({ title, subtitle, close, wide = false, children }: { title: string; subtitle: string; close: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="dialog-overlay"><section className={`dialog ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><header><div><h2>{title}</h2><p>{subtitle}</p></div><button onClick={close} aria-label="Close"><X size={19} /></button></header>{children}</section></div>;
}


function VehicleDialog({ close, done }: { close: () => void; done: (message: string) => void }) {
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [fuelType, setFuelType] = useState("Petrol");
  const [transmission, setTransmission] = useState("Manual");
  const [modelYear, setModelYear] = useState(new Date().getFullYear());
  const [dailyRate, setDailyRate] = useState(1500);
  const [odometerKm, setOdometerKm] = useState(0);
  const [allowedKmPerDay, setAllowedKmPerDay] = useState(100);
  const [extraKmRate, setExtraKmRate] = useState(12);
  const [mileageKmPerLitre, setMileageKmPerLitre] = useState(15);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !make.trim() || !registrationNumber.trim()) {
      setError("Vehicle name, make and registration number are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          make: make.trim(),
          registrationNumber: registrationNumber.trim(),
          fuelType,
          transmission,
          modelYear,
          dailyRate,
          odometerKm,
          allowedKmPerDay,
          extraKmRate,
          mileageKmPerLitre,
          imageUrl: imageUrl.trim(),
        }),
      });
      const payload = await readApiResponse<{ ok: boolean; error?: string }>(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not save vehicle.");
      done(`${name.trim()} added to fleet`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save vehicle.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Add vehicle" subtitle="Add a vehicle to the live fleet database" close={close} wide>
    <form className="simple-form" onSubmit={submit}>
      <div className="field-grid">
        <label className="field"><span>Vehicle name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Maruti Swift" /></label>
        <label className="field"><span>Make / manufacturer</span><input required value={make} onChange={(event) => setMake(event.target.value)} placeholder="Maruti Suzuki" /></label>
        <label className="field"><span>Registration number</span><input required value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value.toUpperCase())} placeholder="KL 35 AB 1234" /></label>
        <label className="field"><span>Model year</span><input required min="1980" max="2100" type="number" value={modelYear} onChange={(event) => setModelYear(Number(event.target.value))} /></label>
        <label className="field"><span>Fuel type</span><select value={fuelType} onChange={(event) => setFuelType(event.target.value)}><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option><option>CNG</option></select></label>
        <label className="field"><span>Transmission</span><select value={transmission} onChange={(event) => setTransmission(event.target.value)}><option>Manual</option><option>Automatic</option></select></label>
        <label className="field"><span>Daily rental rate (₹)</span><input required min="1" step="1" type="number" value={dailyRate} onChange={(event) => setDailyRate(Number(event.target.value))} /></label>
        <label className="field"><span>Current odometer (KM)</span><input required min="0" step="1" type="number" value={odometerKm} onChange={(event) => setOdometerKm(Number(event.target.value))} /></label>
        <label className="field"><span>Allowed KM / day</span><input required min="1" step="1" type="number" value={allowedKmPerDay} onChange={(event) => setAllowedKmPerDay(Number(event.target.value))} /></label>
        <label className="field"><span>Extra KM rate (₹)</span><input required min="0" step="0.01" type="number" value={extraKmRate} onChange={(event) => setExtraKmRate(Number(event.target.value))} /></label>
        <label className="field"><span>Mileage (KM/L)</span><input required min="0.1" step="0.1" type="number" value={mileageKmPerLitre} onChange={(event) => setMileageKmPerLitre(Number(event.target.value))} /></label>
        <label className="field"><span>Image path / URL (optional)</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/cars/swift.jpg" /></label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving}><Check size={16} />{saving ? "Saving…" : "Add vehicle"}</button></div>
    </form>
  </DialogShell>;
}

function NewRentalDialog({ vehicles, customers, addCustomer, close, done, showToast }: { vehicles: Vehicle[]; customers: CustomerRow[]; addCustomer: () => Promise<string | null>; close: () => void; done: (message: string, plate: string) => void; showToast: (message: string) => void }) {
  const availableVehicles = vehicles.filter((item) => item.statusKey === "available");
  const firstVehicle = availableVehicles[0] ?? null;
  const firstCustomer = customers[0] ?? null;
  const [vehicle, setVehicle] = useState(firstVehicle ? `${firstVehicle.name} — ${firstVehicle.plate}` : "");
  const [customerPhone, setCustomerPhone] = useState(firstCustomer?.phone ?? "");
  const [startDate, setStartDate] = useState(() => dateInputValue(new Date()));
  const [returnDate, setReturnDate] = useState(() => dateInputValue(new Date(Date.now() + 5 * 86_400_000)));
  const [startTime, setStartTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("18:00");
  const [rate, setRate] = useState(firstVehicle?.rate ?? 0);
  const [advance, setAdvance] = useState(Math.min(3000, (firstVehicle?.rate ?? 0) * 5));
  const [deposit, setDeposit] = useState(5000);
  const [discount, setDiscount] = useState(0);
  const [startingKilometer, setStartingKilometer] = useState(firstVehicle?.odometerKm ?? 0);
  const [startingFuelRangeKm, setStartingFuelRangeKm] = useState(100);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(startDate).getTime()) / 86_400_000));
  const rentalAmount = days * rate;
  const total = Math.max(0, rentalAmount - discount);
  const selectedVehicle = vehicles.find((item) => vehicle.includes(item.plate)) ?? firstVehicle;
  const selectedCustomer = customers.find((item) => item.phone === customerPhone) ?? null;
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
    const phone = await addCustomer();
    if (phone) {
      setCustomerPhone(phone);
      showToast("New customer selected for this rental");
    }
  }

  return <DialogShell title="Create a new rental" subtitle="Vehicle → Customer → Rental details" close={close} wide>
    <div className="stepper"><span className="done"><i><Check size={13} /></i>Vehicle</span><b /><span className="active"><i>2</i>Customer & dates</span><b /><span><i>3</i>Handover</span></div>
    <form className="rental-form" onSubmit={submit}>
      <div className="form-content"><section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>Vehicle and customer</h3><p>Only available vehicles can be selected.</p></div></div><div className="field-grid"><label className="field span-2"><span>Vehicle</span><select value={vehicle} onChange={(event) => { const next = vehicles.find((item) => event.target.value.includes(item.plate)); setVehicle(event.target.value); if (next) { setRate(next.rate); setStartingKilometer(next.odometerKm); } }} disabled={!availableVehicles.length}>{availableVehicles.length ? availableVehicles.map((item) => <option key={item.id}>{item.name} — {item.plate}</option>) : <option>No available vehicles</option>}</select></label><label className="field"><span>Customer</span><select value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} disabled={!customers.length}>{customers.length ? customers.map((item) => <option key={item.id} value={item.phone}>{item.name}</option>) : <option value="">No customers</option>}</select></label><button type="button" className="new-customer" onClick={() => void addCustomerHere()}><UserRoundPlus size={16} />Add new customer</button></div></section>
        <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Duration and price update automatically.</p></div></div><div className="field-grid four"><label className="field"><span>Start date</span><input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="field"><span>Start time</span><input required type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field"><span>Expected return</span><input required type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label><label className="field"><span>Return time</span><input required type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label></div><div className="duration-note"><CalendarRange size={16} /><strong>{days} rental days</strong><span>{startDate} → {returnDate}</span></div></section>
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Vehicle handover</h3><p>Expected return kilometer updates automatically.</p></div></div><div className="field-grid three"><label className="field"><span>Current / Starting Kilometer</span><input required min="0" type="number" value={startingKilometer} onChange={(event) => setStartingKilometer(Number(event.target.value))} /></label><label className="field"><span>Allowed KM Per Day</span><input readOnly value={`${selectedVehicle?.allowedKmPerDay ?? 0} km`} /></label><label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Starting Fuel Range (KM)</span><input required min="0" type="number" value={startingFuelRangeKm} onChange={(event) => setStartingFuelRangeKm(Number(event.target.value))} /></label></div></section>
        <section className="form-section"><div className="form-section-title"><span><WalletCards size={17} /></span><div><h3>Payment details</h3><p>Record the advance and deposit received.</p></div></div><div className="field-grid three"><label className="field"><span>Daily rate (₹)</span><input required min="0" type="number" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label><label className="field"><span>Security deposit (₹)</span><input min="0" type="number" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} /></label><label className="field"><span>Advance paid (₹)</span><input min="0" max={total} type="number" value={advance} onChange={(event) => setAdvance(Number(event.target.value))} /></label><label className="field"><span>Discount (₹)</span><input min="0" max={rentalAmount} type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div></section>
      </div><aside className="bill-summary"><div className="summary-car"><span><CarFront size={21} /></span><div><strong>{selectedVehicle?.name ?? "No vehicle"}</strong><small>{selectedVehicle?.plate ?? "Add a vehicle first"}</small></div></div><h3>Rental summary</h3><div className="bill-line"><span>{days} days × {money(rate)}</span><strong>{money(rentalAmount)}</strong></div><div className="bill-line"><span>Other charges</span><strong>₹0</strong></div><div className="bill-line"><span>Discount</span><strong>− {money(discount)}</strong></div><div className="bill-total"><span>Total amount</span><strong>{money(total)}</strong></div><div className="bill-line paid"><span>Advance paid</span><strong>− {money(advance)}</strong></div><div className="bill-balance"><span>Balance due</span><strong>{money(Math.max(0, total - advance))}</strong></div><div className="deposit-note"><ShieldCheck size={15} /><span><strong>{money(deposit)} security deposit</strong><small>Held separately and refundable</small></span></div>{error && <p className="form-error">{error}</p>}<button className="confirm-rental" type="submit" disabled={saving || !selectedVehicle || !customerPhone}>{saving ? "Saving…" : "Confirm rental"} {!saving && <ArrowRight size={16} />}</button><button className="save-draft" type="button" disabled={saving || !selectedVehicle || !customerPhone} onClick={() => void saveRental("draft")}>{saving ? "Saving…" : "Save as draft"}</button></aside>
    </form>
  </DialogShell>;
}

function RentalDetailDialog({ rental, close, switchDialog, sendWhatsApp }: { rental: Rental; close: () => void; switchDialog: (dialog: DialogType) => void; sendWhatsApp: (rental: Rental, purpose?: string) => void }) {
  const collectedPercent = rental.total > 0 ? Math.min(100, Math.round((rental.paid / rental.total) * 100)) : 100;
  return <DialogShell title={rental.id} subtitle={`${rental.vehicle} · ${rental.plate}`} close={close} wide>
    <div className="detail-hero"><img src={rental.image} alt={`${rental.vehicle} vehicle`} /><div><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span><h2>{rental.vehicle}</h2><p>{rental.plate}</p></div><div className="detail-contact"><a href={`tel:${rental.phone.replaceAll(" ", "")}`}><Phone size={16} />Call</a><button onClick={() => sendWhatsApp(rental, "rental reminder")}><MessageCircle size={16} />WhatsApp</button></div></div>
    <div className="detail-layout"><div className="detail-main"><section className="detail-section"><div className="detail-title"><span><UserRound size={17} /></span><div><h3>Customer</h3><p>Verified customer details</p></div></div><div className="customer-detail-card"><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.phone}</small></div><div><small>Driving licence</small><strong>{rental.licence}</strong></div><ShieldCheck size={18} /></div></section><section className="detail-section"><div className="detail-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Original booking dates</p></div></div><div className="timeline"><div><i /><span><small>Rental started</small><strong>{rental.start}</strong></span></div><b /><div><i /><span><small>Expected return</small><strong>{rental.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Rental days</small><strong>{rental.days} days</strong></div><div><small>Daily rate</small><strong>{money(rental.rate)}</strong></div><div><small>Starting odometer</small><strong>{rental.startingKilometer.toLocaleString("en-IN")} km</strong></div><div><small>Expected return KM</small><strong>{calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay).toLocaleString("en-IN")} km</strong></div><div><small>Fuel range at handover</small><strong>{rental.startingFuelRangeKm} km</strong></div><div><small>Allowed per day</small><strong>{rental.allowedKmPerDay} km</strong></div></div></section></div><aside className="financial-card"><div className="detail-title"><span><ReceiptIndianRupee size={17} /></span><div><h3>Financial summary</h3><p>Updated live</p></div></div><div className="financial-line"><span>Rental amount</span><strong>{money(rental.rentalAmount)}</strong></div><div className="financial-line"><span>Additional charges</span><strong>{money(rental.otherCharges)}</strong></div><div className="financial-line"><span>Discount</span><strong>− {money(rental.bookingDiscount)}</strong></div><div className="financial-total"><span>Total</span><strong>{money(rental.total)}</strong></div><div className="financial-line paid"><span>Amount paid</span><strong>{money(rental.paid)}</strong></div><div className="financial-balance"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><div className="paid-progress"><span style={{ width: `${collectedPercent}%` }} /></div><small className="paid-caption">{collectedPercent}% collected</small><button className="receive-button" onClick={() => switchDialog("payment")} disabled={rental.balance <= 0}><CreditCard size={16} />Receive payment</button></aside></div>
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
      const response = await fetch("/api/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bookingNumber: rental.id, amount, method, notes }) });
      const payload = await readApiResponse<{ ok: boolean; error?: string; payment?: { paymentNumber: string; balance: number } }>(response);
      if (!response.ok || !payload.payment) throw new Error(payload.error ?? "Could not record payment.");
      done(`${money(amount)} payment ${payload.payment.paymentNumber} recorded for ${rental.customer}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  return <DialogShell title="Receive payment" subtitle={`${rental.customer} · ${rental.id}`} close={close}><form className="simple-form" onSubmit={submit}><div className="amount-due"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><label className="field"><span>Amount received (₹)</span><input required min="0.01" max={rental.balance} step="0.01" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label><label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional payment note" /></label><div className="remaining-box"><span>Remaining after payment</span><strong>{money(Math.max(0, rental.balance - amount))}</strong></div>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || amount <= 0 || amount > rental.balance}><Check size={16} />{saving ? "Recording…" : "Record payment"}</button></div></form></DialogShell>;
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
  const [actualReturnTime, setActualReturnTime] = useState("18:00");
  const [actualReturnKilometer, setActualReturnKilometer] = useState(expectedReturnKilometer + 154);
  const [returnFuelRangeKm, setReturnFuelRangeKm] = useState(Math.max(0, rental.startingFuelRangeKm - 50));
  const [fuelPricePerLitre, setFuelPricePerLitre] = useState(105);
  const [lateFee, setLateFee] = useState(rental.state === "overdue" ? 1500 : 0);
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
  const calculation = calculateSettlement({
    baseRentalAmount: rental.total,
    rentalDays: rental.days,
    startingKilometer: rental.startingKilometer,
    actualReturnKilometer,
    allowedKmPerDay: rental.allowedKmPerDay,
    extraKmRate: rental.extraKmRate,
    startingFuelRangeKm: rental.startingFuelRangeKm,
    returnFuelRangeKm,
    mileageKmPerLitre: rental.mileageKmPerLitre,
    fuelPricePerLitre,
    lateFee,
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
          actualReturnAt: new Date(`${actualReturnDate}T${actualReturnTime}:00+05:30`).toISOString(),
          actualReturnKilometer,
          returnFuelRangeKm,
          fuelPricePerLitre,
          lateFee,
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
          <label className="field"><span>Actual Return Kilometer</span><input required min={rental.startingKilometer} type="number" value={actualReturnKilometer} onChange={(event) => setActualReturnKilometer(Number(event.target.value))} /></label>
          <label className="field"><span>Starting Kilometer</span><input readOnly value={`${rental.startingKilometer.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Total Allowed Kilometers</span><input readOnly value={`${calculation.allowedKilometers.toLocaleString("en-IN")} km`} /></label>
          <label className="field"><span>Starting Fuel Range (KM)</span><input readOnly value={rental.startingFuelRangeKm} /></label>
          <label className="field"><span>Return Fuel Range (KM)</span><input required min="0" type="number" value={returnFuelRangeKm} onChange={(event) => setReturnFuelRangeKm(Number(event.target.value))} /></label>
          <label className="field"><span>Current Fuel Price Per Litre (₹)</span><input required min="0" step="0.01" type="number" value={fuelPricePerLitre} onChange={(event) => setFuelPricePerLitre(Number(event.target.value))} /></label>
          <label className="field span-2"><span>Vehicle condition</span><select value={vehicleCondition} onChange={(event) => setVehicleCondition(event.target.value)}><option>Good — no new damage</option><option>Minor new damage</option><option>Major damage</option></select></label>
        </div></section>
        <section className="form-section"><div className="form-section-title"><span><IndianRupee size={17} /></span><div><h3>Additional charges</h3><p>Extra KM and fuel shortage are automatic; add other charges only when applicable.</p></div></div><div className="charge-grid">
          <label><span>Extra KM ({calculation.extraKilometers} km)</span><input readOnly value={calculation.extraKmCharge} /></label>
          <label><span>Fuel shortage ({calculation.fuelRangeShortageKm} km)</span><input readOnly value={calculation.fuelCharge} /></label>
          <label><span>Late fee</span><input min="0" type="number" value={lateFee} onChange={(event) => setLateFee(Number(event.target.value))} /></label>
          <label><span>Cleaning</span><input min="0" type="number" value={cleaning} onChange={(event) => setCleaning(Number(event.target.value))} /></label>
          <label><span>Damage</span><input min="0" type="number" value={damage} onChange={(event) => setDamage(Number(event.target.value))} /></label>
        </div><p className="calculation-note">Fuel needed: {calculation.requiredFuelLitres.toFixed(3)} L · Mileage: {rental.mileageKmPerLitre} km/L · Extra KM rate: {money(rental.extraKmRate)}/km</p><label className="field"><span>Return notes</span><textarea value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} placeholder="Condition, damage or payment notes" /></label></section>
      </div>
      <aside className="final-bill"><h3>Final bill</h3><div><span>Base rental amount</span><strong>{money(rental.total)}</strong></div><div><span>Extra kilometer charge</span><strong>{money(calculation.extraKmCharge)}</strong></div><div><span>Fuel shortage charge</span><strong>{money(calculation.fuelCharge)}</strong></div><div><span>Other applicable charges</span><strong>{money(lateFee + cleaning + damage)}</strong></div><div className="final-total"><span>Subtotal</span><strong>{money(calculation.subtotal)}</strong></div><label className="field"><span>Discount Amount (optional)</span><input min="0" max={calculation.subtotal} step="0.01" type="number" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value))} /></label><label className="field"><span>Discount Remark (optional)</span><input value={discountRemark} onChange={(event) => setDiscountRemark(event.target.value)} placeholder="e.g. Regular Customer" /></label><div className="final-total"><span>Final amount</span><strong>{money(calculation.finalAmount)}</strong></div><div className="paid"><span>Already recorded</span><strong>− {money(rental.paid)}</strong></div><div className="due"><span>Balance due</span><strong>{money(calculation.amountDue)}</strong></div><label className="maintenance-check"><input type="checkbox" checked={sendToMaintenance} onChange={(event) => setSendToMaintenance(event.target.checked)} /><span><Wrench size={16} /><span><strong>Send to maintenance</strong><small>Vehicle will not become available</small></span></span></label>{error && <p className="form-error">{error}</p>}<button type="submit" className="confirm-rental" disabled={saving}>{saving ? "Confirming…" : "Confirm Settlement"} {!saving && <Check size={16} />}</button><button type="button" className="save-draft" onClick={close}>Cancel</button></aside>
    </form>
  </DialogShell>;
}

function ExpenseDialog({ vehicles, close, done }: { vehicles: Vehicle[]; close: () => void; done: (message: string) => void }) {
  const [expenseDate, setExpenseDate] = useState(() => dateInputValue(new Date()));
  const [category, setCategory] = useState("Vehicle service");
  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [amount, setAmount] = useState(2500);
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

  return <DialogShell title="Add an expense" subtitle="Record a simple business or vehicle expense" close={close}><form className="simple-form" onSubmit={submit}><div className="field-grid"><label className="field"><span>Date</span><input required type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} /></label><label className="field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Vehicle service</option><option>Repair</option><option>Insurance</option><option>Fuel</option><option>Cleaning</option><option>Office expense</option><option>Other</option></select></label><label className="field"><span>Vehicle (optional)</span><select value={vehicleRegistration} onChange={(event) => setVehicleRegistration(event.target.value)}><option value="">Not vehicle-specific</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.name} · {vehicle.plate}</option>)}</select></label><label className="field"><span>Amount (₹)</span><input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label></div><label className="field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this expense for?" /></label><label className="field"><span>Payment method</span><select value={method} onChange={(event) => setMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option></select></label>{error && <p className="form-error">{error}</p>}<div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button" disabled={saving || amount <= 0}><Check size={16} />{saving ? "Saving…" : "Save expense"}</button></div></form></DialogShell>;
}
