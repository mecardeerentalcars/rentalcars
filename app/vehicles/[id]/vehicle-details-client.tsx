"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Camera, CarFront, CircleDollarSign, FileCheck2, Fuel, Gauge, IndianRupee,
  Pencil, Save, Settings2, ShieldCheck, Wrench,
} from "lucide-react";
import { compressVehicleImage } from "@/lib/client-image";
import styles from "./vehicle-details.module.css";

type Vehicle = {
  id: string; name: string; make: string; registrationNumber: string; imageUrl: string | null; fuelType: string;
  transmission: string; modelYear: number; dailyRate: number; odometerKm: number; allowedKmPerDay: number;
  extraKmRate: number; mileageKmPerLitre: number; status: string; createdAt: string; updatedAt: string;
};
type DocumentRow = { id: string; documentType: string; documentNumber: string | null; expiryDate: string | null; notes: string | null; updatedAt: string };
type MaintenanceRow = { id: string; title: string; description: string | null; status: string; dueDate: string | null; dueOdometerKm: number | null; amount: number; completedAt: string | null; createdAt: string };
type TyreRow = { id: string; position: string; brand: string | null; model: string | null; size: string | null; installedDate: string | null; installedOdometerKm: number | null; treadDepthMm: number | null; replacementDueDate: string | null; replacementDueOdometerKm: number | null; notes: string | null; updatedAt: string };
type RentalRow = { id: string; bookingNumber: string; customer: string; phone: string; startAt: string; endAt: string; rentalDays: number; dailyRate: number; baseRentalAmount: number; otherCharges: number; status: string };
type ExpenseRow = { id: string; expenseNumber: string; expenseDate: string; category: string; amount: number; description: string | null; method: string };
export type VehicleProfilePayload = { ok: boolean; error?: string; vehicle: Vehicle; documents: DocumentRow[]; maintenance: MaintenanceRow[]; tyres: TyreRow[]; tyreWarning?: string | null; rentals: RentalRow[]; expenses: ExpenseRow[] };

type EditDocument = { documentType: string; documentNumber: string; expiryDate: string; notes: string };
type EditTyre = { position: string; brand: string; model: string; size: string; installedDate: string; installedOdometerKm: string; treadDepthMm: string; replacementDueDate: string; replacementDueOdometerKm: string; notes: string };

const DOCUMENT_TYPES = ["Insurance", "Pollution / PUC", "Registration / RC", "Fitness Certificate", "Permit", "Road Tax"];
const TYRE_POSITIONS = [["front-left","Front left"],["front-right","Front right"],["rear-left","Rear left"],["rear-right","Rear right"],["spare","Spare"]] as const;
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const shortDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "Not recorded";
const dateTime = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
const blankZeroString = (value: string) => /^0(?:\.0+)?$/.test(value.trim()) ? "" : value;

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try { return JSON.parse(text) as T; } catch { throw new Error(text.replace(/\s+/g, " ").slice(0, 300) || `Server returned ${response.status}.`); }
}
function expiryState(expiryDate: string | null) {
  if (!expiryDate) return { text: "Not recorded", tone: "muted" };
  const days = Math.ceil((new Date(`${expiryDate}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { text: `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`, tone: "danger" };
  if (days <= 30) return { text: `Expires in ${days} day${days === 1 ? "" : "s"}`, tone: "warning" };
  return { text: `Valid until ${shortDate(expiryDate)}`, tone: "good" };
}

export default function VehicleDetailsClient({ vehicleId, embedded = false, initialData, onChanged }: { vehicleId: string; embedded?: boolean; initialData?: VehicleProfilePayload | null; onChanged?: () => void }) {
  const [data, setData] = useState<VehicleProfilePayload | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"documents" | "maintenance" | "tyres" | "history">("documents");

  useEffect(() => { setData(initialData ?? null); setTab("documents"); setEditing(false); }, [vehicleId, initialData]);

  async function reload() {
    const response = await fetch(`/api/vehicles/${vehicleId}`, { cache: "no-store" });
    const payload = await readJson<VehicleProfilePayload>(response);
    if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not refresh vehicle details.");
    setData(payload);
    return payload;
  }

  if (!data) return <div className={embedded ? styles.embeddedCenter : styles.center}>Vehicle details are preparing…</div>;
  const { vehicle } = data;
  const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const openMaintenance = data.maintenance.filter((item) => item.status === "open").length;

  if (editing) return <EditVehicleForm data={data} onCancel={() => setEditing(false)} onSaved={async () => {
    try { await reload(); setEditing(false); setError(null); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not refresh vehicle details."); }
  }} />;

  return <main className={embedded ? styles.embedded : styles.page}>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.compactHero}>
      <div className={styles.compactPhoto}>{vehicle.imageUrl ? <img src={vehicle.imageUrl} alt={vehicle.name} /> : <div><CarFront size={38} /><span>No vehicle image</span></div>}</div>
      <div className={styles.compactInfo}>
        <div className={styles.compactTitleRow}><div><p className={styles.eyebrow}>VEHICLE PROFILE</p><h2>{vehicle.name}</h2><strong>{vehicle.registrationNumber}</strong></div><button className={styles.editButton} onClick={() => setEditing(true)}><Pencil size={15} />Edit</button></div>
        <div className={styles.specs}><span><Fuel size={14} />{vehicle.fuelType}</span><span><Settings2 size={14} />{vehicle.transmission}</span><span><CalendarDays size={14} />{vehicle.modelYear}</span></div>
        <div className={styles.fastMetrics}><span><small>Rate</small><b>{money(vehicle.dailyRate)}/day</b></span><span><small>Odometer</small><b>{vehicle.odometerKm.toLocaleString("en-IN")} km</b></span><span><small>Allowed</small><b>{vehicle.allowedKmPerDay} km/day</b></span><span><small>Mileage</small><b>{vehicle.mileageKmPerLitre} km/L</b></span></div>
      </div>
    </section>

    <section className={styles.summaryGrid}>
      <SummaryCard icon={ShieldCheck} label="Documents" value={`${data.documents.length}/${DOCUMENT_TYPES.length} recorded`} />
      <SummaryCard icon={Wrench} label="Open maintenance" value={String(openMaintenance)} />
      <SummaryCard icon={CarFront} label="Rental history" value={`${data.rentals.length} rental${data.rentals.length === 1 ? "" : "s"}`} />
      <SummaryCard icon={IndianRupee} label="Vehicle expenses" value={money(totalExpenses)} />
    </section>

    <nav className={styles.tabs} aria-label="Vehicle detail sections">
      <button className={tab === "documents" ? styles.activeTab : ""} onClick={() => setTab("documents")}>Documents</button>
      <button className={tab === "maintenance" ? styles.activeTab : ""} onClick={() => setTab("maintenance")}>Maintenance</button>
      <button className={tab === "tyres" ? styles.activeTab : ""} onClick={() => setTab("tyres")}>Tyres</button>
      <button className={tab === "history" ? styles.activeTab : ""} onClick={() => setTab("history")}>History</button>
    </nav>

    {tab === "documents" && <ReadDocuments rows={data.documents} />}
    {tab === "maintenance" && <ReadMaintenance rows={data.maintenance} />}
    {tab === "tyres" && <ReadTyres rows={data.tyres} warning={data.tyreWarning ?? null} />}
    {tab === "history" && <ReadHistory rentals={data.rentals} expenses={data.expenses} />}
  </main>;
}

function ReadDocuments({ rows }: { rows: DocumentRow[] }) {
  return <Section title="Documents" subtitle="Insurance, pollution, registration and statutory document status" icon={FileCheck2}><div className={styles.readGrid}>{DOCUMENT_TYPES.map((type) => {
    const row = rows.find((item) => item.documentType === type); const state = expiryState(row?.expiryDate ?? null);
    return <article className={styles.readCard} key={type}><div className={styles.cardHeading}><div><h3>{type}</h3><span className={`${styles.docState} ${styles[state.tone]}`}>{state.text}</span></div></div><dl><dt>Number</dt><dd>{row?.documentNumber || "Not recorded"}</dd><dt>Expiry</dt><dd>{shortDate(row?.expiryDate ?? null)}</dd><dt>Notes</dt><dd>{row?.notes || "—"}</dd></dl></article>;
  })}</div></Section>;
}
function ReadMaintenance({ rows }: { rows: MaintenanceRow[] }) {
  return <Section title="Maintenance & service" subtitle="Service and repair history" icon={Wrench}>{rows.length === 0 ? <div className={styles.empty}>No maintenance records yet.</div> : <div className={styles.timeline}>{rows.map((row) => <article key={row.id} className={styles.maintenanceRow}><div className={`${styles.maintenanceDot} ${row.status === "completed" ? styles.done : ""}`} /><div className={styles.maintenanceBody}><div className={styles.rowTop}><div><h3>{row.title}</h3><p>{row.description || "No description"}</p></div><span className={`${styles.badge} ${row.status === "completed" ? styles.good : styles.warning}`}>{row.status}</span></div><div className={styles.rowMeta}>{row.dueDate && <span>Due {shortDate(row.dueDate)}</span>}{row.dueOdometerKm !== null && <span>{row.dueOdometerKm.toLocaleString("en-IN")} km</span>}{row.amount > 0 && <span>{money(row.amount)}</span>}<span>Added {dateTime(row.createdAt)}</span></div></div></article>)}</div>}</Section>;
}
function ReadTyres({ rows, warning }: { rows: TyreRow[]; warning: string | null }) {
  return <Section title="Tyres" subtitle="Current tyre information for all four wheels and spare" icon={CarFront}>{warning && <div className={styles.warningBox}>{warning}</div>}<div className={styles.readGrid}>{TYRE_POSITIONS.map(([position,label]) => { const row = rows.find((item) => item.position === position); return <article className={styles.readCard} key={position}><h3>{label}</h3><dl><dt>Brand / model</dt><dd>{[row?.brand,row?.model].filter(Boolean).join(" ") || "Not recorded"}</dd><dt>Size</dt><dd>{row?.size || "Not recorded"}</dd><dt>Tread</dt><dd>{row?.treadDepthMm != null ? `${row.treadDepthMm} mm` : "Not recorded"}</dd><dt>Installed</dt><dd>{row?.installedDate ? `${shortDate(row.installedDate)}${row.installedOdometerKm != null ? ` · ${row.installedOdometerKm.toLocaleString("en-IN")} km` : ""}` : "Not recorded"}</dd><dt>Replace by</dt><dd>{row?.replacementDueDate ? shortDate(row.replacementDueDate) : row?.replacementDueOdometerKm != null ? `${row.replacementDueOdometerKm.toLocaleString("en-IN")} km` : "Not recorded"}</dd></dl></article>; })}</div></Section>;
}
function ReadHistory({ rentals, expenses }: { rentals: RentalRow[]; expenses: ExpenseRow[] }) {
  return <Section title="History" subtitle="Rental use and vehicle-linked expenses" icon={CalendarDays}><div className={styles.historyGrid}><div className={styles.tableCard}><h3>Rental history</h3><div className={styles.tableWrap}><table><thead><tr><th>Rental</th><th>Customer</th><th>Period</th><th>Status</th><th>Amount</th></tr></thead><tbody>{rentals.length === 0 ? <tr><td colSpan={5}>No rentals yet.</td></tr> : rentals.map((row) => <tr key={row.id}><td>{row.bookingNumber}</td><td>{row.customer}<small>{row.phone}</small></td><td>{dateTime(row.startAt)} → {dateTime(row.endAt)}</td><td>{row.status}</td><td>{money(row.baseRentalAmount + row.otherCharges)}</td></tr>)}</tbody></table></div></div><div className={styles.tableCard}><h3>Expenses</h3><div className={styles.tableWrap}><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>{expenses.length === 0 ? <tr><td colSpan={4}>No vehicle expenses yet.</td></tr> : expenses.map((row) => <tr key={row.id}><td>{shortDate(row.expenseDate)}</td><td>{row.category}</td><td>{row.description || "—"}</td><td>{money(row.amount)}</td></tr>)}</tbody></table></div></div></div></Section>;
}

function EditVehicleForm({ data, onCancel, onSaved }: { data: VehicleProfilePayload; onCancel: () => void; onSaved: () => Promise<void> }) {
  const v = data.vehicle;
  const [base, setBase] = useState({ name:v.name, make:v.make, registrationNumber:v.registrationNumber, fuelType:v.fuelType, transmission:v.transmission, modelYear:String(v.modelYear), dailyRate:String(v.dailyRate), odometerKm:String(v.odometerKm), allowedKmPerDay:String(v.allowedKmPerDay), extraKmRate:String(v.extraKmRate), mileageKmPerLitre:String(v.mileageKmPerLitre) });
  const initialDocs = useMemo(() => DOCUMENT_TYPES.map((documentType) => { const row=data.documents.find((x)=>x.documentType===documentType); return { documentType, documentNumber:row?.documentNumber??"", expiryDate:row?.expiryDate??"", notes:row?.notes??"" }; }), [data.documents]);
  const [documents, setDocuments] = useState<EditDocument[]>(initialDocs);
  const initialTyres = useMemo(() => TYRE_POSITIONS.map(([position]) => { const row=data.tyres.find((x)=>x.position===position); return { position, brand:row?.brand??"", model:row?.model??"", size:row?.size??"", installedDate:row?.installedDate??"", installedOdometerKm:row?.installedOdometerKm?.toString()??"", treadDepthMm:row?.treadDepthMm?.toString()??"", replacementDueDate:row?.replacementDueDate??"", replacementDueOdometerKm:row?.replacementDueOdometerKm?.toString()??"", notes:row?.notes??"" }; }), [data.tyres]);
  const [tyres, setTyres] = useState<EditTyre[]>(initialTyres);
  const latest = data.maintenance[0] ?? null;
  const [service, setService] = useState({ title:latest?.title??"Periodic service", description:latest?.description??"", dueDate:latest?.dueDate??"", dueOdometerKm:latest?.dueOdometerKm?.toString()??"", amount:latest?.amount?.toString()??"" });
  const [imageFile, setImageFile] = useState<File|null>(null); const [imagePreview,setImagePreview]=useState<string|null>(v.imageUrl); const [processing,setProcessing]=useState(false); const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);

  async function chooseImage(file: File | null) { if (!file) return; setProcessing(true); setError(null); try { const compressed=await compressVehicleImage(file); setImageFile(compressed); setImagePreview(URL.createObjectURL(compressed)); } catch(e){ setError(e instanceof Error?e.message:"Could not prepare image."); } finally { setProcessing(false); } }
  async function save() {
    setSaving(true); setError(null);
    try {
      const response=await fetch(`/api/vehicles/${v.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(base)}); const payload=await readJson<{ok:boolean;error?:string}>(response); if(!response.ok||!payload.ok) throw new Error(payload.error??"Could not update vehicle.");
      const tasks: Promise<unknown>[]=[];
      if(imageFile){ const fd=new FormData(); fd.append("file",imageFile); tasks.push(fetch(`/api/vehicles/${v.id}/image`,{method:"POST",body:fd}).then(async r=>{const p=await readJson<{ok:boolean;error?:string}>(r);if(!r.ok||!p.ok)throw new Error(p.error??"Could not upload image.");})); }
      for(const doc of documents){ if(doc.documentNumber||doc.expiryDate||doc.notes) tasks.push(fetch(`/api/vehicles/${v.id}/documents`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(doc)}).then(async r=>{const p=await readJson<{ok:boolean;error?:string}>(r);if(!r.ok||!p.ok)throw new Error(p.error??`Could not save ${doc.documentType}.`);})); }
      for(const tyre of tyres){ if(tyre.brand||tyre.model||tyre.size||tyre.installedDate||tyre.installedOdometerKm||tyre.treadDepthMm||tyre.replacementDueDate||tyre.replacementDueOdometerKm||tyre.notes) tasks.push(fetch(`/api/vehicles/${v.id}/tyres`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(tyre)}).then(async r=>{const p=await readJson<{ok:boolean;error?:string}>(r);if(!r.ok||!p.ok)throw new Error(p.error??"Could not save tyre details.");})); }
      if(service.title.trim() && (service.description||service.dueDate||service.dueOdometerKm||service.amount||latest)) { const url=latest?`/api/maintenance/${latest.id}`:`/api/vehicles/${v.id}/maintenance`; const method=latest?"PATCH":"POST"; tasks.push(fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(service)}).then(async r=>{const p=await readJson<{ok:boolean;error?:string}>(r);if(!r.ok||!p.ok)throw new Error(p.error??"Could not save maintenance details.");})); }
      await Promise.all(tasks); await onSaved();
    } catch(e){ setError(e instanceof Error?e.message:"Could not update vehicle."); } finally { setSaving(false); }
  }

  return <div className={styles.editWrap}><div className={styles.editHead}><div><h2>Edit vehicle</h2><p>Update the same profile information used when adding a vehicle.</p></div></div>{error&&<div className={styles.error}>{error}</div>}
    <section className={styles.editSection}><h3>Vehicle details</h3><div className={styles.editGrid}>
      <label>Name<input value={base.name} onChange={e=>setBase({...base,name:e.target.value})}/></label><label>Make<input value={base.make} onChange={e=>setBase({...base,make:e.target.value})}/></label><label>Registration<input value={base.registrationNumber} onChange={e=>setBase({...base,registrationNumber:e.target.value.toUpperCase()})}/></label><label>Model year<input type="number" value={blankZeroString(base.modelYear)} onChange={e=>setBase({...base,modelYear:e.target.value})}/></label><label>Fuel<select value={base.fuelType} onChange={e=>setBase({...base,fuelType:e.target.value})}><option>Petrol</option><option>Diesel</option><option>Hybrid</option><option>Electric</option><option>CNG</option></select></label><label>Transmission<select value={base.transmission} onChange={e=>setBase({...base,transmission:e.target.value})}><option>Manual</option><option>Automatic</option></select></label><label>Daily rate<input type="number" value={blankZeroString(base.dailyRate)} onChange={e=>setBase({...base,dailyRate:e.target.value})}/></label><label>Odometer<input type="number" value={blankZeroString(base.odometerKm)} onChange={e=>setBase({...base,odometerKm:e.target.value})}/></label><label>Allowed KM/day<input type="number" value={blankZeroString(base.allowedKmPerDay)} onChange={e=>setBase({...base,allowedKmPerDay:e.target.value})}/></label><label>Extra KM rate<input type="number" value={blankZeroString(base.extraKmRate)} onChange={e=>setBase({...base,extraKmRate:e.target.value})}/></label><label>Mileage KM/L<input type="number" step="0.1" value={blankZeroString(base.mileageKmPerLitre)} onChange={e=>setBase({...base,mileageKmPerLitre:e.target.value})}/></label><label>Vehicle image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processing} onChange={e=>void chooseImage(e.target.files?.[0]??null)}/><small>{processing?"Compressing image…":"Automatically compressed before upload"}</small></label>{imagePreview&&<img className={styles.editPreview} src={imagePreview} alt="Vehicle preview"/>}
    </div></section>
    <section className={styles.editSection}><h3>Documents</h3><div className={styles.editCards}>{documents.map((doc,i)=><article key={doc.documentType}><strong>{doc.documentType}</strong><label>Number<input value={doc.documentNumber} onChange={e=>setDocuments(x=>x.map((d,n)=>n===i?{...d,documentNumber:e.target.value}:d))}/></label><label>Expiry<input type="date" value={doc.expiryDate} onChange={e=>setDocuments(x=>x.map((d,n)=>n===i?{...d,expiryDate:e.target.value}:d))}/></label><label>Notes<input value={doc.notes} onChange={e=>setDocuments(x=>x.map((d,n)=>n===i?{...d,notes:e.target.value}:d))}/></label></article>)}</div></section>
    <section className={styles.editSection}><h3>Maintenance</h3><div className={styles.editGrid}><label>Title<input value={service.title} onChange={e=>setService({...service,title:e.target.value})}/></label><label>Due date<input type="date" value={service.dueDate} onChange={e=>setService({...service,dueDate:e.target.value})}/></label><label>Due KM<input type="number" value={blankZeroString(service.dueOdometerKm)} onChange={e=>setService({...service,dueOdometerKm:e.target.value})}/></label><label>Amount<input type="number" value={blankZeroString(service.amount)} onChange={e=>setService({...service,amount:e.target.value})}/></label><label className={styles.full}>Notes<input value={service.description} onChange={e=>setService({...service,description:e.target.value})}/></label></div></section>
    <section className={styles.editSection}><h3>Tyres</h3><div className={styles.editCards}>{tyres.map((tyre,i)=>{const label=TYRE_POSITIONS.find(([p])=>p===tyre.position)?.[1]??tyre.position;return <article key={tyre.position}><strong>{label}</strong><label>Brand<input value={tyre.brand} onChange={e=>setTyres(x=>x.map((t,n)=>n===i?{...t,brand:e.target.value}:t))}/></label><label>Model<input value={tyre.model} onChange={e=>setTyres(x=>x.map((t,n)=>n===i?{...t,model:e.target.value}:t))}/></label><label>Size<input value={tyre.size} onChange={e=>setTyres(x=>x.map((t,n)=>n===i?{...t,size:e.target.value}:t))}/></label><label>Replace by KM<input type="number" value={blankZeroString(tyre.replacementDueOdometerKm)} onChange={e=>setTyres(x=>x.map((t,n)=>n===i?{...t,replacementDueOdometerKm:e.target.value}:t))}/></label></article>})}</div></section>
    <div className={styles.editActions}><button onClick={onCancel}>Cancel</button><button className={styles.primary} disabled={saving||processing} onClick={()=>void save()}><Save size={15}/>{saving?"Saving…":"Save changes"}</button></div>
  </div>;
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) { return <article className={styles.summaryCard}><div className={styles.summaryIcon}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong></div></article>; }
function Section({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Gauge; children: React.ReactNode }) { return <section className={styles.section}><header className={styles.sectionHeader}><div className={styles.sectionIcon}><Icon size={20}/></div><div><h2>{title}</h2><p>{subtitle}</p></div></header>{children}</section>; }
