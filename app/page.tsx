"use client";

import { useMemo, useState } from "react";
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
type DialogType = null | "new-rental" | "rental-detail" | "payment" | "extend" | "return" | "expense";
type RentalState = "active" | "today" | "overdue" | "completed";

type Rental = {
  id: string;
  vehicle: string;
  plate: string;
  image: string;
  customer: string;
  phone: string;
  licence: string;
  start: string;
  returnDate: string;
  days: number;
  rate: number;
  total: number;
  paid: number;
  balance: number;
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
  id: number;
  name: string;
  make: string;
  plate: string;
  image: string;
  fuel: string;
  transmission: string;
  year: number;
  rate: number;
  odometer: string;
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

const vehicles: Vehicle[] = [
  { id: 1, name: "Maruti Swift", make: "Maruti Suzuki", plate: "KL 35 AB 1234", image: "/cars/swift.jpg", fuel: "Petrol", transmission: "Manual", year: 2023, rate: 1500, odometer: "34,218 km", status: "Rented", statusKey: "rented", note: "Returns 21 Aug", docs: "Insurance valid until Mar 2027", allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 18 },
  { id: 2, name: "Hyundai Creta", make: "Hyundai", plate: "KL 07 CP 9082", image: "/cars/creta.jpg", fuel: "Diesel", transmission: "Automatic", year: 2024, rate: 2500, odometer: "21,604 km", status: "Returning today", statusKey: "today", note: "Due today, 4:30 PM", docs: "Insurance expires in 10 days", allowedKmPerDay: 120, extraKmRate: 15, mileageKmPerLitre: 17 },
  { id: 3, name: "Toyota Innova", make: "Toyota", plate: "KL 39 M 4412", image: "/cars/innova.jpg", fuel: "Diesel", transmission: "Manual", year: 2022, rate: 3200, odometer: "67,102 km", status: "Overdue", statusKey: "overdue", note: "Overdue by 2 days", docs: "Service due in 898 km", allowedKmPerDay: 150, extraKmRate: 18, mileageKmPerLitre: 13 },
  { id: 4, name: "Maruti Baleno", make: "Maruti Suzuki", plate: "KL 40 R 7270", image: "/cars/baleno.jpg", fuel: "Petrol", transmission: "Automatic", year: 2024, rate: 1800, odometer: "18,430 km", status: "Available", statusKey: "available", note: "Ready to rent", docs: "All documents current", allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 20 },
  { id: 5, name: "Maruti Ertiga", make: "Maruti Suzuki", plate: "KL 08 BX 6601", image: "/cars/ertiga.jpg", fuel: "Petrol", transmission: "Manual", year: 2021, rate: 2400, odometer: "76,890 km", status: "Maintenance", statusKey: "maintenance", note: "Brake service", docs: "Pollution certificate due soon", allowedKmPerDay: 140, extraKmRate: 15, mileageKmPerLitre: 16 },
];

const rentals: Rental[] = [
  { id: "RNT-2048", vehicle: "Maruti Swift", plate: "KL 35 AB 1234", image: "/cars/swift.jpg", customer: "Arun Kumar", phone: "+91 98765 43210", licence: "KL0820160012345", start: "16 Aug, 10:00 AM", returnDate: "21 Aug, 6:00 PM", days: 5, rate: 1500, total: 7500, paid: 3000, balance: 4500, state: "active", statusText: "3 days remaining", progress: 40, startingKilometer: 34218, startingFuelRangeKm: 100, allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 18 },
  { id: "RNT-2047", vehicle: "Hyundai Creta", plate: "KL 07 CP 9082", image: "/cars/creta.jpg", customer: "Nikhil Jose", phone: "+91 97444 12890", licence: "KL0720140098172", start: "12 Aug, 9:30 AM", returnDate: "Today, 4:30 PM", days: 4, rate: 2500, total: 10500, paid: 8000, balance: 2500, state: "today", statusText: "Returning today", progress: 78, startingKilometer: 21200, startingFuelRangeKm: 180, allowedKmPerDay: 120, extraKmRate: 15, mileageKmPerLitre: 17 },
  { id: "RNT-2041", vehicle: "Toyota Innova", plate: "KL 39 M 4412", image: "/cars/innova.jpg", customer: "Fasil Rahman", phone: "+91 98950 76213", licence: "KL3920180067821", start: "9 Aug, 10:00 AM", returnDate: "14 Aug, 10:00 AM", days: 5, rate: 3200, total: 16000, paid: 10000, balance: 6000, state: "overdue", statusText: "Overdue by 2 days", progress: 100, startingKilometer: 66700, startingFuelRangeKm: 220, allowedKmPerDay: 150, extraKmRate: 18, mileageKmPerLitre: 13 },
  { id: "RNT-2039", vehicle: "Maruti Baleno", plate: "KL 40 R 7270", image: "/cars/baleno.jpg", customer: "Sreejith Nair", phone: "+91 94472 11339", licence: "KL4020110029123", start: "2 Aug, 8:00 AM", returnDate: "5 Aug, 7:00 PM", days: 3, rate: 1800, total: 5400, paid: 5400, balance: 0, state: "completed", statusText: "Completed", progress: 100, startingKilometer: 18000, startingFuelRangeKm: 120, allowedKmPerDay: 100, extraKmRate: 12, mileageKmPerLitre: 20 },
  { id: "RNT-2033", vehicle: "Maruti Ertiga", plate: "KL 08 BX 6601", image: "/cars/ertiga.jpg", customer: "Akhil Dev", phone: "+91 81290 44781", licence: "KL0820130088761", start: "27 Jul, 1:00 PM", returnDate: "31 Jul, 1:00 PM", days: 4, rate: 2400, total: 10200, paid: 10200, balance: 0, state: "completed", statusText: "Completed", progress: 100, startingKilometer: 76250, startingFuelRangeKm: 160, allowedKmPerDay: 140, extraKmRate: 15, mileageKmPerLitre: 16 },
];

const customers = [
  { name: "Arun Kumar", initials: "AK", phone: "+91 98765 43210", city: "Muvattupuzha", licence: "KL08 •••• 2345", rentals: 4, spent: 28600, pending: 4500, active: "Maruti Swift" },
  { name: "Nikhil Jose", initials: "NJ", phone: "+91 97444 12890", city: "Kakkanad", licence: "KL07 •••• 8172", rentals: 7, spent: 64200, pending: 2500, active: "Hyundai Creta" },
  { name: "Fasil Rahman", initials: "FR", phone: "+91 98950 76213", city: "Perumbavoor", licence: "KL39 •••• 7821", rentals: 2, spent: 24900, pending: 6000, active: "Toyota Innova" },
  { name: "Sreejith Nair", initials: "SN", phone: "+91 94472 11339", city: "Aluva", licence: "KL40 •••• 9123", rentals: 5, spent: 41800, pending: 0, active: null },
  { name: "Akhil Dev", initials: "AD", phone: "+91 81290 44781", city: "Kothamangalam", licence: "KL08 •••• 8761", rentals: 3, spent: 27100, pending: 0, active: null },
];

const payments = [
  { id: "PAY-889", customer: "Nikhil Jose", rental: "RNT-2047", date: "16 Aug, 9:42 AM", amount: 3000, method: "UPI", receivedBy: "Ajmal" },
  { id: "PAY-888", customer: "Arun Kumar", rental: "RNT-2048", date: "16 Aug, 8:20 AM", amount: 3000, method: "Cash", receivedBy: "Ajmal" },
  { id: "PAY-884", customer: "Fasil Rahman", rental: "RNT-2041", date: "13 Aug, 3:15 PM", amount: 5000, method: "Bank transfer", receivedBy: "Ajmal" },
  { id: "PAY-881", customer: "Sreejith Nair", rental: "RNT-2039", date: "5 Aug, 7:12 PM", amount: 3400, method: "UPI", receivedBy: "Ajmal" },
];

const expenses = [
  { date: "16 Aug", category: "Vehicle service", vehicle: "Maruti Ertiga", description: "Brake pads and labour", method: "UPI", amount: 4200, icon: Wrench },
  { date: "14 Aug", category: "Cleaning", vehicle: "Toyota Innova", description: "Interior deep clean", method: "Cash", amount: 650, icon: Sparkles },
  { date: "10 Aug", category: "Insurance", vehicle: "Hyundai Creta", description: "Policy renewal advance", method: "Bank transfer", amount: 8500, icon: ShieldCheck },
  { date: "7 Aug", category: "Office expense", vehicle: "—", description: "Receipt books and stationery", method: "Cash", amount: 480, icon: FileText },
];

const navItems: { label: string; view: View; icon: LucideIcon; badge?: string }[] = [
  { label: "Dashboard", view: "dashboard", icon: LayoutDashboard },
  { label: "Rentals", view: "rentals", icon: CalendarRange, badge: "3" },
  { label: "Vehicles", view: "vehicles", icon: CarFront },
  { label: "Customers", view: "customers", icon: UsersRound },
  { label: "Payments", view: "payments", icon: WalletCards },
  { label: "Accounts", view: "accounts", icon: BarChart3 },
];

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [dialog, setDialog] = useState<DialogType>(null);
  const [rentalList, setRentalList] = useState<Rental[]>(rentals);
  const [vehicleList, setVehicleList] = useState<Vehicle[]>(vehicles);
  const [selectedRental, setSelectedRental] = useState<Rental>(rentals[0]);
  const [search, setSearch] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    const vehicleResults = vehicleList.filter((v) => `${v.name} ${v.plate}`.toLowerCase().includes(query)).map((v) => ({ type: "Vehicle", title: v.name, meta: `${v.plate} · ${v.status}`, action: () => goTo("vehicles") }));
    const customerResults = customers.filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(query)).map((c) => ({ type: "Customer", title: c.name, meta: `${c.phone} · ${c.rentals} rentals`, action: () => goTo("customers") }));
    const rentalResults = rentalList.filter((r) => `${r.id} ${r.vehicle} ${r.plate} ${r.customer}`.toLowerCase().includes(query)).map((r) => ({ type: "Rental", title: r.id, meta: `${r.vehicle} · ${r.customer}`, action: () => openRental(r) }));
    return [...vehicleResults, ...customerResults, ...rentalResults].slice(0, 6);
  }, [search, rentalList, vehicleList]);

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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  function markVehicleRented(plate: string) {
    setVehicleList((current) => current.map((vehicle) => vehicle.plate === plate ? { ...vehicle, status: "Rented", statusKey: "rented", note: "Currently with customer" } : vehicle));
  }

  function handleSettlementConfirmed(result: SettlementResult, actualReturnKilometer: number) {
    const updatedRental: Rental = {
      ...selectedRental,
      total: result.calculation.finalAmount,
      balance: result.calculation.amountDue,
      state: "completed",
      statusText: "Completed",
      progress: 100,
    };
    setSelectedRental(updatedRental);
    setRentalList((current) => current.map((rental) => rental.id === updatedRental.id ? updatedRental : rental));
    setVehicleList((current) => current.map((vehicle) => vehicle.plate === updatedRental.plate ? {
      ...vehicle,
      status: result.vehicleStatus === "maintenance" ? "Maintenance" : "Available",
      statusKey: result.vehicleStatus,
      odometer: `${actualReturnKilometer.toLocaleString("en-IN")} km`,
      note: result.vehicleStatus === "maintenance" ? "Return inspection — maintenance" : "Ready to rent",
    } : vehicle));
    showToast(`${updatedRental.vehicle} return settlement confirmed`);
  }

  return (
    <div className="app-shell">
      <Sidebar view={view} goTo={goTo} />
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
              <button className="icon-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
              {notificationsOpen && <Notifications onClose={() => setNotificationsOpen(false)} openRental={() => openRental(rentalList[1])} />}
            </div>
            <button className="primary-button" onClick={() => setDialog("new-rental")}><Plus size={17} /> New rental</button>
          </div>
        </header>

        <div className="content">
          {view === "dashboard" && <Dashboard rentals={rentalList} openRental={openRental} openNew={() => setDialog("new-rental")} goTo={goTo} showToast={showToast} />}
          {view === "rentals" && <RentalsView rentals={rentalList} openRental={openRental} openNew={() => setDialog("new-rental")} />}
          {view === "vehicles" && <VehiclesView vehicles={vehicleList} openNew={() => setDialog("new-rental")} showToast={showToast} />}
          {view === "customers" && <CustomersView openNew={() => setDialog("new-rental")} showToast={showToast} />}
          {view === "payments" && <PaymentsView rentals={rentalList} openPayment={() => { setSelectedRental(rentalList[0]); setDialog("payment"); }} />}
          {view === "accounts" && <AccountsView openExpense={() => setDialog("expense")} />}
        </div>
      </main>

      <MobileNav view={view} goTo={goTo} openNew={() => setDialog("new-rental")} />
      {mobileMenuOpen && <MobileMenu view={view} goTo={goTo} close={() => setMobileMenuOpen(false)} />}
      {dialog === "new-rental" && <NewRentalDialog vehicles={vehicleList} close={() => setDialog(null)} done={(message, plate) => { markVehicleRented(plate); setDialog(null); showToast(message); }} showToast={showToast} />}
      {dialog === "rental-detail" && <RentalDetailDialog rental={selectedRental} close={() => setDialog(null)} switchDialog={setDialog} showToast={showToast} />}
      {dialog === "payment" && <PaymentDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); }} />}
      {dialog === "extend" && <ExtendDialog rental={selectedRental} close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); }} />}
      {dialog === "return" && <ReturnDialog rental={selectedRental} close={() => setDialog(null)} onConfirmed={handleSettlementConfirmed} />}
      {dialog === "expense" && <ExpenseDialog close={() => setDialog(null)} done={(message) => { setDialog(null); showToast(message); }} />}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast}</span></div>}
    </div>
  );
}

function Sidebar({ view, goTo }: { view: View; goTo: (view: View) => void }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">M</span><div><strong>Mecardee</strong><small>Rental Manager</small></div></div>
    <nav aria-label="Primary navigation">
      <span className="nav-label">WORKSPACE</span>
      {navItems.map((item) => { const Icon = item.icon; return <button key={item.view} className={`nav-item ${view === item.view ? "active" : ""}`} onClick={() => goTo(item.view)}><Icon size={17} /><span>{item.label}</span>{item.badge && <b>{item.badge}</b>}</button>; })}
      <span className="nav-label lower">INSIGHTS</span>
      <button className="nav-item"><FileText size={17} /><span>Reports</span></button>
      <button className="nav-item"><Settings2 size={17} /><span>Settings</span></button>
    </nav>
    <div className="sidebar-health"><div className="health-head"><span className="pulse" /><strong>Fleet health</strong><b>82%</b></div><div className="health-bar"><span /></div><small>4 of 5 vehicles are road-ready</small></div>
    <div className="profile-mini"><span>AK</span><div><strong>Ajmal K.</strong><small>Owner</small></div><MoreHorizontal size={17} /></div>
  </aside>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</section>;
}

function Dashboard({ rentals, openRental, openNew, goTo, showToast }: { rentals: Rental[]; openRental: (rental: Rental) => void; openNew: () => void; goTo: (view: View) => void; showToast: (message: string) => void }) {
  const stats = [
    { label: "Total cars", value: "5", note: "Registered fleet", icon: CarFront, tone: "neutral" },
    { label: "Available", value: "2", note: "Ready to rent", icon: CheckCircle2, tone: "green" },
    { label: "On rent", value: "3", note: "With customers", icon: CalendarDays, tone: "blue" },
    { label: "Returning today", value: "1", note: "Due by 4:30 PM", icon: Clock3, tone: "amber" },
    { label: "Overdue", value: "1", note: "Follow up now", icon: AlertTriangle, tone: "red" },
    { label: "Pending payments", value: "₹13,000", note: "Across 3 rentals", icon: IndianRupee, tone: "money" },
  ];
  return <>
    <PageHeading eyebrow="SUNDAY, 16 AUGUST" title="Good morning, Ajmal" description="Here’s what needs your attention today." action={<button className="mobile-new" onClick={openNew}><Plus size={16} />New rental</button>} />
    <section className="ai-brief-card">
      <div className="ai-glow ai-glow-one" /><div className="ai-glow ai-glow-two" />
      <div className="ai-brief-top"><span><Sparkles size={14} />Smart briefing</span><i>Live</i></div>
      <h2>Your fleet is moving smoothly.</h2>
      <p>Two cars are ready to rent. Creta returns today, and Innova needs a quick follow-up.</p>
      <div className="ai-brief-insights"><span><b>₹13k</b><small>to collect</small></span><span><b>2</b><small>cars ready</small></span><span><b>1</b><small>urgent task</small></span></div>
      <button onClick={() => openRental(rentals[2])}>Review today’s focus <ArrowRight size={15} /></button>
    </section>
    <section className="stats-grid" aria-label="Fleet summary">
      {stats.map((stat) => { const Icon = stat.icon; return <article className={`stat-card ${stat.tone}`} key={stat.label}><div className="stat-top"><span>{stat.label}</span><i><Icon size={15} /></i></div><strong>{stat.value}</strong><small>{stat.note}</small></article>; })}
    </section>
    <section className="attention-card"><div className="attention-icon"><AlertTriangle size={18} /></div><div><strong>2 items need your attention</strong><p>Toyota Innova is overdue and a payment reminder is pending.</p></div><button onClick={() => openRental(rentals[2])}>Review now <ArrowRight size={14} /></button></section>
    <div className="dashboard-layout">
      <section className="rentals-section">
        <div className="section-title"><div><h2>Current rentals</h2><p>3 vehicles are currently with customers</p></div><button onClick={() => goTo("rentals")}>View all <ArrowRight size={14} /></button></div>
        <div className="rental-stack">{rentals.slice(0, 3).map((rental) => <RentalCard rental={rental} key={rental.id} open={() => openRental(rental)} showToast={showToast} />)}</div>
      </section>
      <aside className="dashboard-side">
        <section className="side-card">
          <div className="side-card-title"><div><h3>Reminders</h3><span>3 active</span></div><button aria-label="Reminder settings"><SlidersHorizontal size={15} /></button></div>
          <Reminder tone="urgent" icon={AlertTriangle} title="Toyota Innova is overdue" text="Expected back 2 days ago" action={() => openRental(rentals[2])} />
          <Reminder tone="upcoming" icon={ShieldCheck} title="Creta insurance expires" text="Due in 10 days" />
          <Reminder tone="normal" icon={Wrench} title="Innova service due" text="In another 898 km" />
          <button className="full-link">View all reminders <ChevronRight size={15} /></button>
        </section>
        <section className="side-card money-snapshot">
          <div className="side-card-title"><div><h3>Today’s money</h3><span>Live snapshot</span></div><span className="round-icon"><WalletCards size={16} /></span></div>
          <div className="money-line"><span>Collected</span><strong>₹6,000</strong></div><div className="money-line"><span>Expenses</span><strong className="negative">− ₹4,200</strong></div><div className="net-line"><span>Net today</span><strong>₹1,800</strong></div>
          <button className="full-link" onClick={() => goTo("accounts")}>Open accounts <ChevronRight size={15} /></button>
        </section>
      </aside>
    </div>
  </>;
}

function RentalCard({ rental, open, showToast }: { rental: Rental; open: () => void; showToast: (message: string) => void }) {
  return <article className={`rental-row ${rental.state}`}>
    <button className="rental-main" onClick={open}>
      <img src={rental.image} alt="" />
      <span className="rental-vehicle"><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span><strong>{rental.vehicle}</strong><small>{rental.plate} · {rental.id}</small></span>
      <span className="rental-customer"><small>Customer</small><strong>{rental.customer}</strong><span>{rental.phone}</span></span>
      <span className="rental-return"><small>Expected return</small><strong>{rental.returnDate}</strong><span>{rental.days} days · {money(rental.rate)}/day</span></span>
      <span className="rental-balance"><small>Balance due</small><strong>{money(rental.balance)}</strong><span>{money(rental.paid)} paid</span></span>
      <ChevronRight className="row-chevron" size={18} />
    </button>
    <div className="rental-quick"><a href={`tel:${rental.phone.replaceAll(" ", "")}`} aria-label={`Call ${rental.customer}`}><Phone size={15} /></a><button onClick={() => showToast(`WhatsApp reminder prepared for ${rental.customer}`)} aria-label={`WhatsApp ${rental.customer}`}><MessageCircle size={15} /></button><button onClick={open}><MoreHorizontal size={16} /></button></div>
  </article>;
}

function Reminder({ tone, icon: Icon, title, text, action }: { tone: string; icon: LucideIcon; title: string; text: string; action?: () => void }) {
  return <button className={`reminder ${tone}`} onClick={action}><span><Icon size={15} /></span><div><strong>{title}</strong><small>{text}</small></div><ChevronRight size={15} /></button>;
}

function RentalsView({ rentals, openRental, openNew }: { rentals: Rental[]; openRental: (rental: Rental) => void; openNew: () => void }) {
  const [filter, setFilter] = useState("All");
  const shown = filter === "All" ? rentals : rentals.filter((rental) => filter === "Active" ? rental.state !== "completed" : rental.state === filter.toLowerCase());
  return <>
    <PageHeading eyebrow="RENTAL OPERATIONS" title="Rentals" description="Track every booking from handover to final payment." action={<button className="primary-button" onClick={openNew}><Plus size={17} />New rental</button>} />
    <section className="mini-stats"><article><CalendarDays size={19} /><div><span>Active rentals</span><strong>3</strong></div></article><article><Clock3 size={19} /><div><span>Returning today</span><strong>1</strong></div></article><article><AlertTriangle size={19} /><div><span>Overdue</span><strong>1</strong></div></article><article><CircleDollarSign size={19} /><div><span>Outstanding</span><strong>₹13,000</strong></div></article></section>
    <section className="data-panel">
      <div className="panel-toolbar"><div className="filter-tabs">{["All", "Active", "Overdue", "Completed"].map((item) => <button key={item} onClick={() => setFilter(item)} className={filter === item ? "active" : ""}>{item}</button>)}</div><div className="toolbar-actions"><button><CalendarRange size={15} />Date range</button><button><SlidersHorizontal size={15} />Filters</button></div></div>
      <div className="history-table"><div className="table-head"><span>Rental</span><span>Customer</span><span>Rental period</span><span>Amount</span><span>Balance</span><span>Status</span><span /></div>{shown.map((rental) => <button className="history-row" key={rental.id} onClick={() => openRental(rental)}><span className="vehicle-cell"><img src={rental.image} alt="" /><span><strong>{rental.vehicle}</strong><small>{rental.plate} · {rental.id}</small></span></span><span><strong>{rental.customer}</strong><small>{rental.phone}</small></span><span><strong>{rental.start.split(",")[0]} → {rental.returnDate.split(",")[0]}</strong><small>{rental.days} rental days</small></span><span><strong>{money(rental.total)}</strong><small>{money(rental.rate)}/day</small></span><span><strong className={rental.balance ? "red-text" : "green-text"}>{money(rental.balance)}</strong><small>{money(rental.paid)} paid</small></span><span><i className={`status-pill ${rental.state}`}><b />{rental.statusText}</i></span><ChevronRight size={16} /></button>)}</div>
    </section>
  </>;
}

function VehiclesView({ vehicles, openNew, showToast }: { vehicles: Vehicle[]; openNew: () => void; showToast: (message: string) => void }) {
  const [filter, setFilter] = useState("All vehicles");
  const shown = filter === "All vehicles" ? vehicles : vehicles.filter((vehicle) => vehicle.statusKey === filter.toLowerCase());
  return <>
    <PageHeading eyebrow="FLEET" title="Vehicles" description="Your full fleet, availability and document health in one place." action={<div className="heading-actions"><button className="secondary-button" onClick={() => showToast("Add vehicle form is ready for the database phase")}><Plus size={16} />Add vehicle</button><button className="primary-button" onClick={openNew}><CalendarDays size={16} />Rent a car</button></div>} />
    <section className="fleet-strip"><div><span className="strip-icon"><CarFront size={19} /></span><p><strong>5 vehicles</strong><small>Total fleet</small></p></div><div><i className="dot available" /><p><strong>2 available</strong><small>40% of fleet</small></p></div><div><i className="dot rented" /><p><strong>3 on rent</strong><small>One is overdue</small></p></div><div><i className="dot maintenance" /><p><strong>1 in service</strong><small>Brake work</small></p></div><span className="fleet-progress"><i style={{ width: "82%" }} /></span></section>
    <div className="panel-toolbar vehicle-toolbar"><div className="filter-tabs">{["All vehicles", "Available", "Rented", "Maintenance"].map((item) => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><button className="filter-button"><SlidersHorizontal size={15} />More filters</button></div>
    <section className="vehicle-grid">{shown.map((vehicle) => <article className="vehicle-card" key={vehicle.id}><div className="vehicle-photo"><img src={vehicle.image} alt={`${vehicle.name} vehicle`} /><span className={`vehicle-status ${vehicle.statusKey}`}><i />{vehicle.status}</span><button aria-label={`More options for ${vehicle.name}`}><MoreHorizontal size={17} /></button></div><div className="vehicle-card-body"><div className="vehicle-title"><div><h3>{vehicle.name}</h3><p>{vehicle.plate}</p></div><strong>{money(vehicle.rate)}<small>/ day</small></strong></div><div className="spec-row"><span><Fuel size={14} />{vehicle.fuel}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.year}</span></div><div className="odometer"><span><Gauge size={15} />Odometer</span><strong>{vehicle.odometer}</strong></div><div className={`document-note ${vehicle.statusKey === "overdue" || vehicle.statusKey === "today" ? "warning" : ""}`}><ShieldCheck size={14} /><span><strong>{vehicle.note}</strong><small>{vehicle.docs}</small></span></div><div className="vehicle-actions"><button>View vehicle</button><button onClick={openNew} disabled={vehicle.statusKey !== "available"}>{vehicle.statusKey === "available" ? "Rent now" : "Unavailable"}</button></div></div></article>)}</section>
  </>;
}

function CustomersView({ openNew, showToast }: { openNew: () => void; showToast: (message: string) => void }) {
  return <>
    <PageHeading eyebrow="CUSTOMER DIRECTORY" title="Customers" description="Rental history, documents and balances—without duplicate records." action={<button className="primary-button" onClick={() => showToast("New customer form opened in the rental flow")}><UserRoundPlus size={17} />Add customer</button>} />
    <section className="customer-summary"><article><UsersRound size={20} /><div><strong>42</strong><span>Total customers</span></div><small><TrendingUp size={13} /> 6 this month</small></article><article><CalendarDays size={20} /><div><strong>3</strong><span>Currently renting</span></div><small>7% of customers</small></article><article><IndianRupee size={20} /><div><strong>₹13,000</strong><span>Pending balance</span></div><small className="warn"><AlertTriangle size={13} /> 3 customers</small></article></section>
    <section className="data-panel customer-panel"><div className="panel-toolbar"><label className="panel-search"><Search size={16} /><input aria-label="Search customers" placeholder="Search name or mobile number" /></label><button className="filter-button"><SlidersHorizontal size={15} />Filters</button></div><div className="customer-list"><div className="customer-list-head"><span>Customer</span><span>Driving licence</span><span>Rental activity</span><span>Amount spent</span><span>Balance</span><span /></div>{customers.map((customer) => <article className="customer-list-row" key={customer.phone}><span className="customer-identity"><i>{customer.initials}</i><span><strong>{customer.name}</strong><small>{customer.phone} · {customer.city}</small></span></span><span><strong>{customer.licence}</strong><small>Verified</small></span><span><strong>{customer.rentals} rentals</strong><small>{customer.active ? `Active: ${customer.active}` : "No active rental"}</small></span><span><strong>{money(customer.spent)}</strong><small>Lifetime value</small></span><span><strong className={customer.pending ? "red-text" : "green-text"}>{money(customer.pending)}</strong><small>{customer.pending ? "Pending" : "Fully paid"}</small></span><span className="customer-actions"><button aria-label={`Call ${customer.name}`}><Phone size={15} /></button><button onClick={openNew}>{customer.active ? "View rental" : "Rent again"}</button><ChevronRight size={16} /></span></article>)}</div></section>
  </>;
}

function PaymentsView({ rentals, openPayment }: { rentals: Rental[]; openPayment: () => void }) {
  return <>
    <PageHeading eyebrow="COLLECTIONS" title="Payments" description="Every receipt and outstanding balance, clearly tracked." action={<button className="primary-button" onClick={openPayment}><Plus size={17} />Receive payment</button>} />
    <section className="payment-summary"><article className="featured"><span>Collected this month</span><strong>₹1,42,500</strong><small><TrendingUp size={14} /> 12.4% vs last month</small></article><article><span>Collected today</span><strong>₹6,000</strong><small>2 payments</small></article><article><span>Outstanding</span><strong>₹13,000</strong><small className="red-text">Across 3 rentals</small></article><article><span>Security deposits held</span><strong>₹15,000</strong><small>3 active rentals</small></article></section>
    <div className="payments-layout"><section className="data-panel"><div className="panel-heading"><div><h2>Recent payments</h2><p>Latest customer collections</p></div><button><Download size={15} />Export</button></div><div className="payments-table"><div className="payments-head"><span>Customer</span><span>Rental</span><span>Date</span><span>Method</span><span>Amount</span></div>{payments.map((payment) => <article key={payment.id}><span><i>{payment.customer.split(" ").map((part) => part[0]).join("")}</i><span><strong>{payment.customer}</strong><small>{payment.id}</small></span></span><span><strong>{payment.rental}</strong><small>Received by {payment.receivedBy}</small></span><span>{payment.date}</span><span><b>{payment.method}</b></span><strong className="green-text">+ {money(payment.amount)}</strong></article>)}</div></section><aside className="outstanding-card"><div className="panel-heading"><div><h2>Outstanding</h2><p>Follow up with 3 customers</p></div></div>{rentals.slice(0,3).sort((a,b) => b.balance - a.balance).map((rental) => <article key={rental.id}><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.vehicle} · {rental.statusText}</small></div><b>{money(rental.balance)}</b><button aria-label={`Send reminder to ${rental.customer}`}><Send size={14} /></button></article>)}<button className="full-link">View outstanding report <ChevronRight size={15} /></button></aside></div>
  </>;
}

function AccountsView({ openExpense }: { openExpense: () => void }) {
  const chart = [38, 62, 48, 78, 56, 91, 68, 74, 54, 84, 66, 96];
  return <>
    <PageHeading eyebrow="MONEY & ACCOUNTS" title="Business overview" description="Simple income and expenses—only what you need to run the day." action={<button className="primary-button" onClick={openExpense}><Plus size={17} />Add expense</button>} />
    <section className="accounts-summary"><article><span>Rental revenue</span><strong>₹1,68,400</strong><small className="green-text"><TrendingUp size={13} /> 8.2% this month</small></article><article><span>Amount collected</span><strong>₹1,42,500</strong><small>84.6% collection rate</small></article><article><span>Pending amount</span><strong>₹25,900</strong><small className="red-text">6 open balances</small></article><article><span>Total expenses</span><strong>₹32,840</strong><small><TrendingDown size={13} /> 4.1% lower</small></article><article className="net"><span>Approx. net income</span><strong>₹1,09,660</strong><small>After recorded expenses</small></article></section>
    <div className="accounts-layout"><section className="data-panel revenue-panel"><div className="panel-heading"><div><h2>Revenue overview</h2><p>Income collected over the last 12 months</p></div><button>2026 <ChevronDown size={14} /></button></div><div className="chart-total"><span>Total collected</span><strong>₹12.8L</strong></div><div className="bar-chart">{chart.map((value, index) => <div key={index}><span style={{ height: `${value}%` }} className={index === 11 ? "current" : ""} /><small>{["Sep","Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"][index]}</small></div>)}</div></section><section className="data-panel expense-panel"><div className="panel-heading"><div><h2>Recent expenses</h2><p>₹13,830 recorded this month</p></div><button onClick={openExpense}><Plus size={15} />Add</button></div><div className="expense-list">{expenses.map((expense) => { const Icon = expense.icon; return <article key={`${expense.date}-${expense.category}`}><span className="expense-icon"><Icon size={16} /></span><div><strong>{expense.category}</strong><small>{expense.description} · {expense.vehicle}</small></div><span><strong>− {money(expense.amount)}</strong><small>{expense.date} · {expense.method}</small></span></article>; })}</div><button className="full-link">View all expenses <ChevronRight size={15} /></button></section></div>
  </>;
}

function Notifications({ onClose, openRental }: { onClose: () => void; openRental: () => void }) {
  return <div className="notifications-panel"><div className="notification-head"><div><strong>Notifications</strong><span>3 new</span></div><button onClick={onClose}><X size={16} /></button></div><button onClick={openRental}><span className="notice-icon urgent"><Clock3 size={15} /></span><div><strong>Creta is due today</strong><small>KL 07 CP 9082 · Return at 4:30 PM</small><time>8 min ago</time></div></button><button><span className="notice-icon payment"><IndianRupee size={15} /></span><div><strong>₹4,500 pending from Arun</strong><small>Send a professional payment reminder</small><time>32 min ago</time></div></button><button><span className="notice-icon warning"><ShieldCheck size={15} /></span><div><strong>Insurance expires in 10 days</strong><small>Hyundai Creta · KL 07 CP 9082</small><time>Today</time></div></button><div className="notification-footer">Mark all as read</div></div>;
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

function NewRentalDialog({ vehicles, close, done, showToast }: { vehicles: Vehicle[]; close: () => void; done: (message: string, plate: string) => void; showToast: (message: string) => void }) {
  const availableVehicles = vehicles.filter((item) => item.statusKey === "available");
  const firstVehicle = availableVehicles[0] ?? vehicles[0];
  const [vehicle, setVehicle] = useState(`${firstVehicle.name} — ${firstVehicle.plate}`);
  const [customer, setCustomer] = useState("Arun Kumar");
  const [startDate, setStartDate] = useState("2026-08-16");
  const [returnDate, setReturnDate] = useState("2026-08-21");
  const [startTime, setStartTime] = useState("10:00");
  const [returnTime, setReturnTime] = useState("18:00");
  const [rate, setRate] = useState(firstVehicle.rate);
  const [advance, setAdvance] = useState(3000);
  const [deposit, setDeposit] = useState(5000);
  const [discount, setDiscount] = useState(0);
  const [startingKilometer, setStartingKilometer] = useState(Number(firstVehicle.odometer.replace(/\D/g, "")));
  const [startingFuelRangeKm, setStartingFuelRangeKm] = useState(100);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = Math.max(1, Math.ceil((new Date(returnDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const rentalAmount = days * rate;
  const total = rentalAmount - discount;
  const selectedVehicle = vehicles.find((item) => vehicle.includes(item.plate)) ?? firstVehicle;
  const expectedReturnKilometer = calculateExpectedReturnKilometer(startingKilometer, days, selectedVehicle.allowedKmPerDay);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const customerPhone = customers.find((item) => item.name === customer)?.phone;
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
        }),
      });
      const payload = await response.json() as { ok: boolean; error?: string; rental?: { bookingNumber: string } };
      if (!response.ok || !payload.rental) throw new Error(payload.error ?? "Could not save the rental.");
      done(`${selectedVehicle.name} rental ${payload.rental.bookingNumber} created for ${customer}`, selectedVehicle.plate);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the rental.");
    } finally {
      setSaving(false);
    }
  }
  return <DialogShell title="Create a new rental" subtitle="Vehicle → Customer → Rental details" close={close} wide>
    <div className="stepper"><span className="done"><i><Check size={13} /></i>Vehicle</span><b /><span className="active"><i>2</i>Customer & dates</span><b /><span><i>3</i>Handover</span></div>
    <form className="rental-form" onSubmit={submit}>
      <div className="form-content"><section className="form-section"><div className="form-section-title"><span><CarFront size={17} /></span><div><h3>Vehicle and customer</h3><p>Only available vehicles can be selected.</p></div></div><div className="field-grid"><label className="field span-2"><span>Vehicle</span><select value={vehicle} onChange={(event) => { const next = vehicles.find((item) => event.target.value.includes(item.plate)); setVehicle(event.target.value); if (next) { setRate(next.rate); setStartingKilometer(Number(next.odometer.replace(/\D/g, ""))); } }}>{availableVehicles.map((item) => <option key={item.id}>{item.name} — {item.plate}</option>)}</select></label><label className="field"><span>Customer</span><select value={customer} onChange={(event) => setCustomer(event.target.value)}><option>Arun Kumar</option><option>Sreejith Nair</option><option>Akhil Dev</option></select></label><button type="button" className="new-customer"><UserRoundPlus size={16} />Add new customer</button></div></section>
        <section className="form-section"><div className="form-section-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Duration and price update automatically.</p></div></div><div className="field-grid four"><label className="field"><span>Start date</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="field"><span>Start time</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label className="field"><span>Expected return</span><input type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} /></label><label className="field"><span>Return time</span><input type="time" value={returnTime} onChange={(event) => setReturnTime(event.target.value)} /></label></div><div className="duration-note"><CalendarRange size={16} /><strong>{days} rental days</strong><span>{startDate} → {returnDate}</span></div></section>
        <section className="form-section"><div className="form-section-title"><span><Gauge size={17} /></span><div><h3>Vehicle handover</h3><p>Expected return kilometer updates automatically.</p></div></div><div className="field-grid three"><label className="field"><span>Current / Starting Kilometer</span><input required min="0" type="number" value={startingKilometer} onChange={(event) => setStartingKilometer(Number(event.target.value))} /></label><label className="field"><span>Allowed KM Per Day</span><input readOnly value={`${selectedVehicle.allowedKmPerDay} km`} /></label><label className="field"><span>Expected Return Kilometer</span><input readOnly value={`${expectedReturnKilometer.toLocaleString("en-IN")} km`} /></label><label className="field"><span>Starting Fuel Range (KM)</span><input required min="0" type="number" value={startingFuelRangeKm} onChange={(event) => setStartingFuelRangeKm(Number(event.target.value))} /></label></div></section>
        <section className="form-section"><div className="form-section-title"><span><WalletCards size={17} /></span><div><h3>Payment details</h3><p>Record the advance and deposit received.</p></div></div><div className="field-grid three"><label className="field"><span>Daily rate (₹)</span><input min="0" type="number" value={rate} onChange={(event) => setRate(Number(event.target.value))} /></label><label className="field"><span>Security deposit (₹)</span><input min="0" type="number" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} /></label><label className="field"><span>Advance paid (₹)</span><input min="0" type="number" value={advance} onChange={(event) => setAdvance(Number(event.target.value))} /></label><label className="field"><span>Discount (₹)</span><input min="0" max={rentalAmount} type="number" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></label><label className="field"><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label></div></section>
      </div><aside className="bill-summary"><div className="summary-car"><span><CarFront size={21} /></span><div><strong>{vehicle.split("—")[0]}</strong><small>{vehicle.split("—")[1]}</small></div></div><h3>Rental summary</h3><div className="bill-line"><span>{days} days × {money(rate)}</span><strong>{money(rentalAmount)}</strong></div><div className="bill-line"><span>Other charges</span><strong>₹0</strong></div><div className="bill-line"><span>Discount</span><strong>− {money(discount)}</strong></div><div className="bill-total"><span>Total amount</span><strong>{money(total)}</strong></div><div className="bill-line paid"><span>Advance paid</span><strong>− {money(advance)}</strong></div><div className="bill-balance"><span>Balance due</span><strong>{money(Math.max(0, total - advance))}</strong></div><div className="deposit-note"><ShieldCheck size={15} /><span><strong>{money(deposit)} security deposit</strong><small>Held separately and refundable</small></span></div>{error && <p className="form-error">{error}</p>}<button className="confirm-rental" type="submit" disabled={saving}>{saving ? "Saving…" : "Confirm rental"} {!saving && <ArrowRight size={16} />}</button><button className="save-draft" type="button" onClick={() => showToast("Rental saved as draft")}>Save as draft</button></aside>
    </form>
  </DialogShell>;
}

function RentalDetailDialog({ rental, close, switchDialog, showToast }: { rental: Rental; close: () => void; switchDialog: (dialog: DialogType) => void; showToast: (message: string) => void }) {
  return <DialogShell title={rental.id} subtitle={`${rental.vehicle} · ${rental.plate}`} close={close} wide>
    <div className="detail-hero"><img src={rental.image} alt={`${rental.vehicle} vehicle`} /><div><span className={`status-pill ${rental.state}`}><i />{rental.statusText}</span><h2>{rental.vehicle}</h2><p>{rental.plate}</p></div><div className="detail-contact"><a href={`tel:${rental.phone.replaceAll(" ", "")}`}><Phone size={16} />Call</a><button onClick={() => showToast("WhatsApp rental reminder prepared")}><MessageCircle size={16} />WhatsApp</button></div></div>
    <div className="detail-layout"><div className="detail-main"><section className="detail-section"><div className="detail-title"><span><UserRound size={17} /></span><div><h3>Customer</h3><p>Verified customer details</p></div></div><div className="customer-detail-card"><span>{rental.customer.split(" ").map((part) => part[0]).join("")}</span><div><strong>{rental.customer}</strong><small>{rental.phone}</small></div><div><small>Driving licence</small><strong>{rental.licence}</strong></div><ShieldCheck size={18} /></div></section><section className="detail-section"><div className="detail-title"><span><CalendarDays size={17} /></span><div><h3>Rental schedule</h3><p>Original booking dates</p></div></div><div className="timeline"><div><i /><span><small>Rental started</small><strong>{rental.start}</strong></span></div><b /><div><i /><span><small>Expected return</small><strong>{rental.returnDate}</strong></span></div></div><div className="rental-facts"><div><small>Rental days</small><strong>{rental.days} days</strong></div><div><small>Daily rate</small><strong>{money(rental.rate)}</strong></div><div><small>Starting odometer</small><strong>{rental.startingKilometer.toLocaleString("en-IN")} km</strong></div><div><small>Expected return KM</small><strong>{calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay).toLocaleString("en-IN")} km</strong></div><div><small>Fuel range at handover</small><strong>{rental.startingFuelRangeKm} km</strong></div><div><small>Allowed per day</small><strong>{rental.allowedKmPerDay} km</strong></div></div></section></div><aside className="financial-card"><div className="detail-title"><span><ReceiptIndianRupee size={17} /></span><div><h3>Financial summary</h3><p>Updated live</p></div></div><div className="financial-line"><span>Rental amount</span><strong>{money(rental.total)}</strong></div><div className="financial-line"><span>Additional charges</span><strong>₹0</strong></div><div className="financial-line"><span>Discount</span><strong>₹0</strong></div><div className="financial-total"><span>Total</span><strong>{money(rental.total)}</strong></div><div className="financial-line paid"><span>Amount paid</span><strong>{money(rental.paid)}</strong></div><div className="financial-balance"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><div className="paid-progress"><span style={{ width: `${Math.round((rental.paid / rental.total) * 100)}%` }} /></div><small className="paid-caption">{Math.round((rental.paid / rental.total) * 100)}% collected</small><button className="receive-button" onClick={() => switchDialog("payment")}><CreditCard size={16} />Receive payment</button></aside></div>
    <footer className="detail-actions"><button onClick={() => switchDialog("extend")}><CalendarRange size={16} />Extend rental</button><button onClick={() => switchDialog("return")} className="return-button"><CarFront size={16} />Return vehicle</button></footer>
  </DialogShell>;
}

function PaymentDialog({ rental, close, done }: { rental: Rental; close: () => void; done: (message: string) => void }) {
  const [amount, setAmount] = useState(rental.balance);
  return <DialogShell title="Receive payment" subtitle={`${rental.customer} · ${rental.id}`} close={close}><form className="simple-form" onSubmit={(event) => { event.preventDefault(); done(`${money(amount)} payment recorded for ${rental.customer}`); }}><div className="amount-due"><span>Balance pending</span><strong>{money(rental.balance)}</strong></div><label className="field"><span>Amount received (₹)</span><input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label><label className="field"><span>Payment method</span><select defaultValue="UPI"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label><label className="field"><span>Notes</span><textarea placeholder="Optional payment note" /></label><div className="remaining-box"><span>Remaining after payment</span><strong>{money(Math.max(0, rental.balance - amount))}</strong></div><div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button"><Check size={16} />Record payment</button></div></form></DialogShell>;
}

function ExtendDialog({ rental, close, done }: { rental: Rental; close: () => void; done: (message: string) => void }) {
  const [days, setDays] = useState(3);
  const extension = days * rental.rate;
  return <DialogShell title="Extend rental" subtitle={`${rental.vehicle} · ${rental.customer}`} close={close}><form className="simple-form" onSubmit={(event) => { event.preventDefault(); done(`Rental extended by ${days} days · ${money(extension)} added`); }}><div className="extension-summary"><div><span>Current return</span><strong>{rental.returnDate}</strong></div><ArrowRight size={18} /><div><span>New return</span><strong>{21 + days} Aug, 6:00 PM</strong></div></div><label className="field"><span>Additional rental days</span><div className="stepper-input"><button type="button" onClick={() => setDays(Math.max(1, days - 1))}>−</button><input type="number" value={days} onChange={(event) => setDays(Math.max(1, Number(event.target.value)))} /><button type="button" onClick={() => setDays(days + 1)}>+</button></div></label><div className="calculation-box"><div><span>{days} days × {money(rental.rate)}</span><strong>{money(extension)}</strong></div><div><span>Updated rental total</span><strong>{money(rental.total + extension)}</strong></div><div><span>Updated pending balance</span><strong>{money(rental.balance + extension)}</strong></div></div><div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button"><CalendarRange size={16} />Confirm extension</button></div></form></DialogShell>;
}

function ReturnDialog({ rental, close, onConfirmed }: { rental: Rental; close: () => void; onConfirmed: (result: SettlementResult, actualReturnKilometer: number) => void }) {
  const expectedReturnKilometer = calculateExpectedReturnKilometer(rental.startingKilometer, rental.days, rental.allowedKmPerDay);
  const [actualReturnDate, setActualReturnDate] = useState("2026-08-17");
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
          sendToMaintenance,
        }),
      });
      const payload = await response.json() as { ok: boolean; error?: string; settlement?: SettlementResult };
      if (!response.ok || !payload.settlement) throw new Error(payload.error ?? "Could not confirm the return settlement.");
      setConfirmed(payload.settlement);
      onConfirmed(payload.settlement, actualReturnKilometer);
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
          <label className="field span-2"><span>Vehicle condition</span><select defaultValue="Good — no new damage"><option>Good — no new damage</option><option>Minor new damage</option><option>Major damage</option></select></label>
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

function ExpenseDialog({ close, done }: { close: () => void; done: (message: string) => void }) {
  const [amount, setAmount] = useState(2500);
  return <DialogShell title="Add an expense" subtitle="Record a simple business or vehicle expense" close={close}><form className="simple-form" onSubmit={(event) => { event.preventDefault(); done(`${money(amount)} expense recorded`); }}><div className="field-grid"><label className="field"><span>Date</span><input type="date" defaultValue="2026-08-16" /></label><label className="field"><span>Category</span><select><option>Vehicle service</option><option>Repair</option><option>Insurance</option><option>Fuel</option><option>Cleaning</option><option>Office expense</option><option>Other</option></select></label><label className="field"><span>Vehicle (optional)</span><select><option>Maruti Ertiga</option><option>Hyundai Creta</option><option>Toyota Innova</option><option>Not vehicle-specific</option></select></label><label className="field"><span>Amount (₹)</span><input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label></div><label className="field"><span>Description</span><textarea placeholder="What was this expense for?" /></label><label className="field"><span>Payment method</span><select><option>Cash</option><option>UPI</option><option>Bank transfer</option></select></label><div className="form-actions"><button type="button" onClick={close}>Cancel</button><button type="submit" className="primary-button"><Check size={16} />Save expense</button></div></form></DialogShell>;
}
