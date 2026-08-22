// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, expenses, vehicles } from "@/db/schema";

type ExpenseBody = { expenseDate?: unknown; category?: unknown; bookingId?: unknown; vehicleRegistration?: unknown; amount?: unknown; description?: unknown; method?: unknown };
class RequestError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const text = (value: unknown, field: string) => { if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`); return value.trim(); };
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const money = (value: unknown, field: string) => { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new RequestError(`${field} must be greater than zero.`); return Math.round(n * 100) / 100; };
const numberId = () => `EXP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

export async function POST(request: Request) {
  const __mecardeeAuth = await requireWriteAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as ExpenseBody;
    const expenseDate = text(body.expenseDate, "Expense date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) throw new RequestError("Expense date is invalid.");
    const category = text(body.category, "Category");
    const amount = money(body.amount, "Amount");
    const description = optionalText(body.description);
    const method = text(body.method, "Payment method");
    const bookingId = optionalText(body.bookingId);
    const vehicleRegistration = optionalText(body.vehicleRegistration);

    const saved = await withRequestDb(async (db) => {
      let linkedBookingId: string | null = null;
      let linkedBookingVehicleId: string | null = null;
      if (bookingId) {
        const [booking] = await db.select({ id: bookings.id, vehicleId: bookings.vehicleId }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
        if (!booking) throw new RequestError("Selected rental was not found.", 404);
        linkedBookingId = booking.id;
        linkedBookingVehicleId = booking.vehicleId;
      }

      let vehicleId: string | null = null;
      if (vehicleRegistration) {
        const [vehicle] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.registrationNumber, vehicleRegistration)).limit(1);
        if (!vehicle) throw new RequestError("Selected vehicle was not found.", 404);
        vehicleId = vehicle.id;
      } else if (linkedBookingId) {
        vehicleId = linkedBookingVehicleId;
      }

      const paidBy = __mecardeeAuth.user.username;
      const [expense] = await db.insert(expenses).values({
        expenseNumber: numberId(), expenseDate, category, bookingId: linkedBookingId, vehicleId, amount, description, method, createdBy: paidBy,
      }).returning({ expenseNumber: expenses.expenseNumber });
      if (!expense) throw new Error("PostgreSQL did not return the created expense.");
      return { ...expense, paidBy };
    });

    return Response.json({ ok: true, expense: saved }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not save expense", error);
    return Response.json({ ok: false, error: "Could not save the expense." }, { status: 500 });
  }
}
