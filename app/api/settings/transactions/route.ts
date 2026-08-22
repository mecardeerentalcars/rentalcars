// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess, requireWriteAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import { bookings, customers, expenses, payments, returnSettlements, vehicles } from "@/db/schema";

type TransactionType = "payment" | "expense";
type AnyRow = Record<string, any>;

class RequestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const text = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(`${field} is required.`);
  return value.trim();
};
const optionalText = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const money = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new RequestError(`${field} must be greater than zero.`);
  return Math.round(number * 100) / 100;
};
const parseType = (value: unknown): TransactionType => {
  if (value === "payment" || value === "expense") return value;
  throw new RequestError("Transaction type is invalid.");
};
const dateTime = (value: unknown, field: string) => {
  const raw = text(value, field);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new RequestError(`${field} is invalid.`);
  return parsed;
};
const dateOnly = (value: unknown, field: string) => {
  const raw = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new RequestError(`${field} is invalid.`);
  return raw;
};

function rowsOf<T = AnyRow>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) return ((result as { rows?: T[] }).rows ?? []);
  return [];
}

async function ensureDeleteHistoryTable(db: any) {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS transaction_delete_history (
      id uuid PRIMARY KEY,
      transaction_type varchar(24) NOT NULL,
      transaction_id uuid NOT NULL,
      transaction_number varchar(64),
      display_label text,
      snapshot jsonb NOT NULL,
      reason text NOT NULL,
      deleted_by varchar(120) NOT NULL DEFAULT 'Admin',
      deleted_at timestamptz NOT NULL DEFAULT now(),
      restored_at timestamptz,
      restored_by varchar(120)
    )
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS transaction_delete_history_deleted_at_idx
      ON transaction_delete_history (deleted_at DESC)
  `));
}

async function paymentLimit(tx: any, bookingId: string, excludingPaymentId?: string) {
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new RequestError("The linked rental no longer exists. This payment cannot be changed.", 409);
  const [settlement] = await tx
    .select({ finalAmount: returnSettlements.finalAmount })
    .from(returnSettlements)
    .where(eq(returnSettlements.bookingId, bookingId))
    .limit(1);
  const where = excludingPaymentId
    ? and(eq(payments.bookingId, bookingId), ne(payments.id, excludingPaymentId))
    : eq(payments.bookingId, bookingId);
  const [paidRow] = await tx
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::float8` })
    .from(payments)
    .where(where);
  return {
    payable: Number(settlement?.finalAmount ?? booking.baseRentalAmount + booking.otherCharges),
    otherPayments: Number(paidRow?.total ?? 0),
  };
}

export async function GET() {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    return await withRequestDb(async (db) => {
      await ensureDeleteHistoryTable(db);
      const [paymentRows, expenseRows, historyResult] = await Promise.all([
        db
          .select({ payment: payments, booking: bookings, customer: customers })
          .from(payments)
          .innerJoin(bookings, eq(payments.bookingId, bookings.id))
          .innerJoin(customers, eq(payments.customerId, customers.id))
          .orderBy(desc(payments.receivedAt))
          .limit(100),
        db
          .select({ expense: expenses, vehicle: vehicles })
          .from(expenses)
          .leftJoin(vehicles, eq(expenses.vehicleId, vehicles.id))
          .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
          .limit(100),
        db.execute(sql.raw(`
          SELECT
            id,
            transaction_type,
            transaction_id,
            transaction_number,
            display_label,
            reason,
            deleted_by,
            deleted_at,
            restored_at,
            restored_by
          FROM transaction_delete_history
          ORDER BY deleted_at DESC
          LIMIT 100
        `)),
      ]);

      const managedPayments = paymentRows.map(({ payment, booking, customer }) => ({
        id: payment.id,
        number: payment.paymentNumber,
        bookingNumber: booking.bookingNumber,
        bookingId: payment.bookingId,
        customer: customer.name,
        customerId: payment.customerId,
        amount: payment.amount,
        method: payment.method,
        type: payment.paymentType,
        notes: payment.notes,
        receivedBy: payment.receivedBy,
        receivedAt: payment.receivedAt.toISOString(),
      }));
      const managedExpenses = expenseRows.map(({ expense, vehicle }) => ({
        id: expense.id,
        number: expense.expenseNumber,
        expenseDate: expense.expenseDate,
        category: expense.category,
        vehicle: vehicle?.name ?? "",
        plate: vehicle?.registrationNumber ?? "",
        vehicleId: expense.vehicleId,
        bookingId: expense.bookingId,
        amount: expense.amount,
        description: expense.description,
        method: expense.method,
        createdBy: expense.createdBy,
        createdAt: expense.createdAt.toISOString(),
      }));
      const history = rowsOf(historyResult).map((row) => ({
        id: String(row.id),
        transactionType: String(row.transaction_type),
        transactionId: String(row.transaction_id),
        transactionNumber: row.transaction_number ? String(row.transaction_number) : "",
        displayLabel: row.display_label ? String(row.display_label) : "",
        reason: String(row.reason ?? ""),
        deletedBy: String(row.deleted_by ?? "Admin"),
        deletedAt: new Date(row.deleted_at).toISOString(),
        restoredAt: row.restored_at ? new Date(row.restored_at).toISOString() : null,
        restoredBy: row.restored_by ? String(row.restored_by) : null,
      }));

      return Response.json({ ok: true, payments: managedPayments, expenses: managedExpenses, history });
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not load transaction manager", error);
    return Response.json({ ok: false, error: "Could not load transaction manager." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as AnyRow;
    const type = parseType(body.type);
    const id = text(body.id, "Transaction ID");

    return await withRequestDb(async (db) => {
      const result = await db.transaction(async (tx) => {
        if (type === "payment") {
          const [existing] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1).for("update");
          if (!existing) throw new RequestError("Payment was not found.", 404);
          const amount = money(body.amount, "Payment amount");
          const method = text(body.method, "Payment method");
          const notes = optionalText(body.notes);
          const receivedAt = dateTime(body.receivedAt, "Received date/time");
          const limit = await paymentLimit(tx, existing.bookingId, existing.id);
          if (limit.otherPayments + amount > limit.payable + 0.001) {
            const available = Math.max(0, Math.round((limit.payable - limit.otherPayments) * 100) / 100);
            throw new RequestError(`This edit would overpay the rental. Maximum allowed for this payment is ₹${available.toLocaleString("en-IN")}.`, 409);
          }
          await tx.update(payments).set({ amount, method, notes, receivedAt }).where(eq(payments.id, id));
          await tx.update(bookings).set({ updatedAt: new Date() }).where(eq(bookings.id, existing.bookingId));
          return { type, id };
        }

        const [existing] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1).for("update");
        if (!existing) throw new RequestError("Expense was not found.", 404);
        const expenseDate = dateOnly(body.expenseDate, "Expense date");
        const category = text(body.category, "Category");
        const amount = money(body.amount, "Expense amount");
        const description = optionalText(body.description);
        const method = text(body.method, "Payment method");
        await tx.update(expenses).set({ expenseDate, category, amount, description, method }).where(eq(expenses.id, id));
        return { type, id };
      });
      return Response.json({ ok: true, transaction: result });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not edit transaction", error);
    return Response.json({ ok: false, error: "Could not edit the transaction." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as AnyRow;
    const type = parseType(body.type);
    const id = text(body.id, "Transaction ID");
    const reason = text(body.reason, "Deletion reason");
    if (reason.length < 3) throw new RequestError("Please enter a short reason for deleting this transaction.");

    return await withRequestDb(async (db) => {
      await ensureDeleteHistoryTable(db);
      const historyId = crypto.randomUUID();
      const result = await db.transaction(async (tx) => {
        if (type === "payment") {
          const [snapshot] = await tx.select().from(payments).where(eq(payments.id, id)).limit(1).for("update");
          if (!snapshot) throw new RequestError("Payment was not found.", 404);
          const [booking] = await tx.select().from(bookings).where(eq(bookings.id, snapshot.bookingId)).limit(1);
          const [customer] = await tx.select().from(customers).where(eq(customers.id, snapshot.customerId)).limit(1);
          if (!booking || !customer) throw new RequestError("The linked rental or customer no longer exists. Delete was blocked.", 409);
          const label = `${customer.name} · ${booking.bookingNumber} · ₹${Number(snapshot.amount).toLocaleString("en-IN")}`;
          await tx.execute(sql`
            INSERT INTO transaction_delete_history
              (id, transaction_type, transaction_id, transaction_number, display_label, snapshot, reason, deleted_by)
            VALUES
              (${historyId}::uuid, ${type}, ${snapshot.id}::uuid, ${snapshot.paymentNumber}, ${label}, ${JSON.stringify(snapshot)}::jsonb, ${reason}, 'Admin')
          `);
          await tx.delete(payments).where(eq(payments.id, id));
          await tx.update(bookings).set({ updatedAt: new Date() }).where(eq(bookings.id, snapshot.bookingId));
          return { historyId, type, number: snapshot.paymentNumber };
        }

        const [snapshot] = await tx.select().from(expenses).where(eq(expenses.id, id)).limit(1).for("update");
        if (!snapshot) throw new RequestError("Expense was not found.", 404);
        const [vehicle] = snapshot.vehicleId
          ? await tx.select().from(vehicles).where(eq(vehicles.id, snapshot.vehicleId)).limit(1)
          : [];
        const label = `${snapshot.category}${vehicle ? ` · ${vehicle.registrationNumber}` : ""} · ₹${Number(snapshot.amount).toLocaleString("en-IN")}`;
        await tx.execute(sql`
          INSERT INTO transaction_delete_history
            (id, transaction_type, transaction_id, transaction_number, display_label, snapshot, reason, deleted_by)
          VALUES
            (${historyId}::uuid, ${type}, ${snapshot.id}::uuid, ${snapshot.expenseNumber}, ${label}, ${JSON.stringify(snapshot)}::jsonb, ${reason}, 'Admin')
        `);
        await tx.delete(expenses).where(eq(expenses.id, id));
        return { historyId, type, number: snapshot.expenseNumber };
      });
      return Response.json({ ok: true, deleted: result });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not safely delete transaction", error);
    return Response.json({ ok: false, error: "Could not delete the transaction safely." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const __mecardeeAuth = await requireSuperAdminAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    const body = (await request.json()) as AnyRow;
    const action = text(body.action, "Action");
    if (action !== "restore") throw new RequestError("Action is invalid.");
    const historyId = text(body.historyId, "History ID");

    return await withRequestDb(async (db) => {
      await ensureDeleteHistoryTable(db);
      const result = await db.transaction(async (tx) => {
        const historyResult = await tx.execute(sql`
          SELECT * FROM transaction_delete_history WHERE id = ${historyId}::uuid FOR UPDATE
        `);
        const history = rowsOf(historyResult)[0];
        if (!history) throw new RequestError("Delete history record was not found.", 404);
        if (history.restored_at) throw new RequestError("This transaction has already been restored.", 409);
        const type = parseType(history.transaction_type);
        const snapshot = typeof history.snapshot === "string" ? JSON.parse(history.snapshot) : history.snapshot;

        if (type === "payment") {
          const [duplicate] = await tx
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.paymentNumber, String(snapshot.paymentNumber)))
            .limit(1);
          if (duplicate) throw new RequestError("A payment with this number already exists. Restore was blocked.", 409);
          const [booking] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, String(snapshot.bookingId))).limit(1);
          const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, String(snapshot.customerId))).limit(1);
          if (!booking || !customer) throw new RequestError("The linked rental or customer no longer exists, so this payment cannot be restored.", 409);
          const limit = await paymentLimit(tx, String(snapshot.bookingId));
          const amount = Number(snapshot.amount);
          if (limit.otherPayments + amount > limit.payable + 0.001) {
            throw new RequestError("Restoring this payment would overpay the rental. Adjust the current payments first.", 409);
          }
          await tx.insert(payments).values({
            id: String(snapshot.id),
            paymentNumber: String(snapshot.paymentNumber),
            bookingId: String(snapshot.bookingId),
            customerId: String(snapshot.customerId),
            amount,
            method: String(snapshot.method),
            paymentType: String(snapshot.paymentType ?? "rental"),
            notes: snapshot.notes ? String(snapshot.notes) : null,
            receivedBy: String(snapshot.receivedBy ?? "Admin"),
            receivedAt: new Date(snapshot.receivedAt),
            createdAt: new Date(snapshot.createdAt),
          });
          await tx.update(bookings).set({ updatedAt: new Date() }).where(eq(bookings.id, String(snapshot.bookingId)));
        } else {
          const [duplicate] = await tx
            .select({ id: expenses.id })
            .from(expenses)
            .where(eq(expenses.expenseNumber, String(snapshot.expenseNumber)))
            .limit(1);
          if (duplicate) throw new RequestError("An expense with this number already exists. Restore was blocked.", 409);
          let vehicleId: string | null = snapshot.vehicleId ? String(snapshot.vehicleId) : null;
          if (vehicleId) {
            const [vehicle] = await tx.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
            if (!vehicle) vehicleId = null;
          }
          let bookingId: string | null = snapshot.bookingId ? String(snapshot.bookingId) : null;
          if (bookingId) {
            const [booking] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
            if (!booking) bookingId = null;
          }
          await tx.insert(expenses).values({
            id: String(snapshot.id),
            expenseNumber: String(snapshot.expenseNumber),
            expenseDate: String(snapshot.expenseDate),
            category: String(snapshot.category),
            vehicleId,
            bookingId,
            amount: Number(snapshot.amount),
            description: snapshot.description ? String(snapshot.description) : null,
            method: String(snapshot.method),
            createdBy: String(snapshot.createdBy ?? "Admin"),
            createdAt: new Date(snapshot.createdAt),
          });
        }

        await tx.execute(sql`
          UPDATE transaction_delete_history
          SET restored_at = now(), restored_by = 'Admin'
          WHERE id = ${historyId}::uuid
        `);
        return { type, transactionNumber: String(history.transaction_number ?? "") };
      });
      return Response.json({ ok: true, restored: result });
    });
  } catch (error) {
    if (error instanceof RequestError) return Response.json({ ok: false, error: error.message }, { status: error.status });
    if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
    console.error("Could not restore transaction", error);
    return Response.json({ ok: false, error: "Could not restore the transaction." }, { status: 500 });
  }
}
