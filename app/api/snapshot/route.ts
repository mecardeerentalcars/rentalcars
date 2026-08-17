import { asc, desc, eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import {
  bookings,
  customers,
  expenses,
  maintenanceRecords,
  payments,
  returnSettlements,
  vehicleDocuments,
  vehicleTyres,
  vehicles,
} from "@/db/schema";

const TIME_ZONE = "Asia/Kolkata";
const now = () => new Date();
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const dateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const monthKey = (value: Date) => dateKey(value).slice(0, 7);

const formatDateTime = (value: Date, todayKey: string) => {
  const sameDay = dateKey(value) === todayKey;
  const time = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
  if (sameDay) return `Today, ${time}`;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
};

const formatShortDate = (value: Date) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(value);

const formatMonthYear = (isoDate: string) =>
  new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: TIME_ZONE }).format(
    new Date(`${isoDate}T00:00:00+05:30`),
  );

const maskLicence = (licence: string) => {
  if (licence.length <= 8) return licence;
  return `${licence.slice(0, 4)} •••• ${licence.slice(-4)}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

function previousMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 2, 15));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastTwelveMonths(reference: Date) {
  const result: { key: string; label: string }[] = [];
  const ref = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 15));
  for (let offset = 11; offset >= 0; offset -= 1) {
    const value = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - offset, 15));
    const key = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(value);
    result.push({ key, label });
  }
  return result;
}

export async function GET() {
  try {
    return await withRequestDb(async (db) => {
    const [vehicleRows, customerRows, bookingRows, settlementRows, paymentRows, expenseRows, documentRows, maintenanceRows] =
      await Promise.all([
        db.select().from(vehicles).orderBy(asc(vehicles.name)),
        db.select().from(customers).orderBy(asc(customers.name)),
        db
          .select({ booking: bookings, vehicle: vehicles, customer: customers })
          .from(bookings)
          .innerJoin(vehicles, eq(bookings.vehicleId, vehicles.id))
          .innerJoin(customers, eq(bookings.customerId, customers.id))
          .orderBy(desc(bookings.startAt)),
        db.select().from(returnSettlements).orderBy(desc(returnSettlements.createdAt)),
        db
          .select({ payment: payments, customer: customers, booking: bookings })
          .from(payments)
          .innerJoin(customers, eq(payments.customerId, customers.id))
          .innerJoin(bookings, eq(payments.bookingId, bookings.id))
          .orderBy(desc(payments.receivedAt)),
        db
          .select({ expense: expenses, vehicle: vehicles })
          .from(expenses)
          .leftJoin(vehicles, eq(expenses.vehicleId, vehicles.id))
          .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)),
        db.select().from(vehicleDocuments).orderBy(asc(vehicleDocuments.expiryDate)),
        db.select().from(maintenanceRecords).orderBy(desc(maintenanceRecords.createdAt)),
      ]);

    // Vehicle details are prefetched as part of the single app snapshot so opening
    // View vehicle never waits for another database round-trip. Tyres are optional
    // during a rolling migration: if the table is not there yet, the rest of the
    // app still loads immediately.
    let tyreRows: typeof vehicleTyres.$inferSelect[] = [];
    try {
      tyreRows = await db.select().from(vehicleTyres).orderBy(vehicleTyres.position);
    } catch (error) {
      console.warn("Vehicle tyre preload skipped", error);
    }

    const current = now();
    const today = dateKey(current);
    const thisMonth = monthKey(current);
    const lastMonth = previousMonthKey(thisMonth);
    const settlementByBooking = new Map(settlementRows.map((row) => [row.bookingId, row]));
    const paymentsByBooking = new Map<string, number>();
    for (const row of paymentRows) {
      paymentsByBooking.set(
        row.payment.bookingId,
        roundMoney((paymentsByBooking.get(row.payment.bookingId) ?? 0) + row.payment.amount),
      );
    }

    const activeBookingByVehicle = new Map<string, (typeof bookingRows)[number]>();
    for (const row of bookingRows) {
      if (!["booked", "rented"].includes(row.booking.status)) continue;
      if (!activeBookingByVehicle.has(row.booking.vehicleId)) activeBookingByVehicle.set(row.booking.vehicleId, row);
    }

    const documentsByVehicle = new Map<string, typeof documentRows>();
    for (const document of documentRows) {
      const rows = documentsByVehicle.get(document.vehicleId) ?? [];
      rows.push(document);
      documentsByVehicle.set(document.vehicleId, rows);
    }
    const maintenanceByVehicle = new Map<string, typeof maintenanceRows>();
    for (const record of maintenanceRows) {
      const rows = maintenanceByVehicle.get(record.vehicleId) ?? [];
      rows.push(record);
      maintenanceByVehicle.set(record.vehicleId, rows);
    }
    const tyresByVehicle = new Map<string, typeof tyreRows>();
    for (const tyre of tyreRows) {
      const rows = tyresByVehicle.get(tyre.vehicleId) ?? [];
      rows.push(tyre);
      tyresByVehicle.set(tyre.vehicleId, rows);
    }
    const bookingsByVehicle = new Map<string, typeof bookingRows>();
    for (const bookingRow of bookingRows) {
      const rows = bookingsByVehicle.get(bookingRow.booking.vehicleId) ?? [];
      rows.push(bookingRow);
      bookingsByVehicle.set(bookingRow.booking.vehicleId, rows);
    }
    const expensesByVehicle = new Map<string, typeof expenseRows>();
    for (const expenseRow of expenseRows) {
      if (!expenseRow.expense.vehicleId) continue;
      const rows = expensesByVehicle.get(expenseRow.expense.vehicleId) ?? [];
      rows.push(expenseRow);
      expensesByVehicle.set(expenseRow.expense.vehicleId, rows);
    }

    const rentals = bookingRows
      .filter((row) => row.booking.status !== "draft")
      .map((row) => {
        const { booking, vehicle, customer } = row;
        const settlement = settlementByBooking.get(booking.id);
        const paid = roundMoney(paymentsByBooking.get(booking.id) ?? 0);
        const chargeableLateMs = booking.status === "completed" ? 0 : Math.max(0, current.getTime() - booking.endAt.getTime() - 3 * 60 * 60 * 1000);
        const liveLateRentalDays = chargeableLateMs > 0 ? Math.ceil(chargeableLateMs / 86_400_000) : 0;
        const liveLateRentalCharge = roundMoney(liveLateRentalDays * booking.dailyRate);
        const settledLateRentalCharge = settlement?.lateFee ?? 0;
        const lateRentalCharge = settlement ? settledLateRentalCharge : liveLateRentalCharge;
        const lateRentalDays = settlement ? (lateRentalCharge > 0 ? Math.max(1, Math.ceil(lateRentalCharge / Math.max(1, booking.dailyRate))) : 0) : liveLateRentalDays;
        const total = roundMoney(settlement?.finalAmount ?? booking.baseRentalAmount + booking.otherCharges + liveLateRentalCharge);
        const balance = roundMoney(Math.max(0, total - paid));
        let state: "active" | "today" | "overdue" | "completed" = "active";
        let statusText = "Active";
        if (booking.status === "completed") {
          state = "completed";
          statusText = balance > 0 ? "Completed · balance due" : "Completed";
        } else if (current.getTime() > booking.endAt.getTime() + 3 * 60 * 60 * 1000) {
          state = "overdue";
          const chargeableLateMs = current.getTime() - booking.endAt.getTime() - 3 * 60 * 60 * 1000;
          const days = Math.max(1, Math.ceil(chargeableLateMs / 86_400_000));
          statusText = `Overdue · ${days} extra rental day${days === 1 ? "" : "s"}`;
        } else if (current.getTime() > booking.endAt.getTime()) {
          state = "today";
          statusText = "Return grace period · up to 3 hours";
        } else if (dateKey(booking.endAt) === today) {
          state = "today";
          statusText = "Returning today";
        } else {
          const days = Math.max(1, Math.ceil((booking.endAt.getTime() - current.getTime()) / 86_400_000));
          statusText = `${days} day${days === 1 ? "" : "s"} remaining`;
        }
        const duration = Math.max(1, booking.endAt.getTime() - booking.startAt.getTime());
        const progress = booking.status === "completed"
          ? 100
          : Math.max(0, Math.min(100, Math.round(((current.getTime() - booking.startAt.getTime()) / duration) * 100)));
        return {
          id: booking.bookingNumber,
          databaseId: booking.id,
          vehicleId: vehicle.id,
          customerId: customer.id,
          vehicle: vehicle.name,
          plate: vehicle.registrationNumber,
          image: vehicle.imageUrl ?? "/cars/swift.jpg",
          customer: customer.name,
          phone: customer.phone,
          whatsappNumber: customer.whatsappNumber ?? customer.phone,
          licence: customer.drivingLicence,
          start: formatDateTime(booking.startAt, today),
          returnDate: formatDateTime(booking.endAt, today),
          startAt: booking.startAt.toISOString(),
          endAt: booking.endAt.toISOString(),
          days: booking.rentalDays,
          rate: booking.dailyRate,
          rentalAmount: booking.baseRentalAmount + booking.bookingDiscount,
          bookingDiscount: booking.bookingDiscount,
          otherCharges: settlement ? booking.otherCharges + settlement.extraKmCharge + settlement.fuelCharge + settlement.lateFee + settlement.cleaningCharge + settlement.damageCharge : booking.otherCharges + liveLateRentalCharge,
          lateRentalDays,
          lateRentalCharge,
          total,
          paid,
          balance,
          securityDeposit: booking.securityDeposit,
          state,
          statusText,
          progress,
          startingKilometer: booking.startingKilometer ?? vehicle.odometerKm,
          startingFuelRangeKm: booking.startingFuelRangeKm ?? 0,
          allowedKmPerDay: vehicle.allowedKmPerDay,
          extraKmRate: vehicle.extraKmRate,
          mileageKmPerLitre: vehicle.mileageKmPerLitre,
        };
      });

    const rentalById = new Map(rentals.map((rental) => [rental.id, rental]));
    const vehicleDtos = vehicleRows.map((vehicle) => {
      const active = activeBookingByVehicle.get(vehicle.id);
      const activeRental = active ? rentalById.get(active.booking.bookingNumber) : undefined;
      let statusKey = vehicle.status.toLowerCase();
      let status = vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1);
      let note = statusKey === "available" ? "Ready to rent" : "Currently with customer";
      if (vehicle.status === "maintenance") {
        statusKey = "maintenance";
        status = "Maintenance";
        const openMaintenance = (maintenanceByVehicle.get(vehicle.id) ?? []).find((record) => record.status === "open");
        note = openMaintenance?.title ?? "Maintenance in progress";
      } else if (activeRental?.state === "overdue") {
        statusKey = "overdue";
        status = "Overdue";
        note = activeRental.statusText;
      } else if (activeRental?.state === "today") {
        statusKey = "today";
        status = "Returning today";
        note = `Due ${activeRental.returnDate}`;
      } else if (activeRental) {
        statusKey = "rented";
        status = "Rented";
        note = `Returns ${formatShortDate(new Date(activeRental.endAt))}`;
      }

      let docs = "All documents current";
      const document = (documentsByVehicle.get(vehicle.id) ?? []).find((item) => item.expiryDate);
      if (document?.expiryDate) {
        const expiry = new Date(`${document.expiryDate}T00:00:00+05:30`);
        const days = Math.ceil((expiry.getTime() - current.getTime()) / 86_400_000);
        if (days < 0) docs = `${document.documentType} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
        else if (days <= 30) docs = `${document.documentType} expires in ${days} day${days === 1 ? "" : "s"}`;
        else docs = `${document.documentType} valid until ${formatMonthYear(document.expiryDate)}`;
      } else {
        const service = (maintenanceByVehicle.get(vehicle.id) ?? []).find(
          (record) => record.status === "open" && record.dueOdometerKm !== null,
        );
        if (service?.dueOdometerKm) {
          const remaining = service.dueOdometerKm - vehicle.odometerKm;
          docs = remaining >= 0 ? `Service due in ${remaining.toLocaleString("en-IN")} km` : "Service odometer is overdue";
        }
      }

      return {
        id: vehicle.id,
        name: vehicle.name,
        make: vehicle.make,
        plate: vehicle.registrationNumber,
        image: vehicle.imageUrl ?? "/cars/swift.jpg",
        fuel: vehicle.fuelType,
        transmission: vehicle.transmission,
        year: vehicle.modelYear,
        rate: vehicle.dailyRate,
        odometer: `${vehicle.odometerKm.toLocaleString("en-IN")} km`,
        odometerKm: vehicle.odometerKm,
        status,
        statusKey,
        note,
        docs,
        allowedKmPerDay: vehicle.allowedKmPerDay,
        extraKmRate: vehicle.extraKmRate,
        mileageKmPerLitre: vehicle.mileageKmPerLitre,
      };
    });

    const vehicleProfiles = Object.fromEntries(vehicleRows.map((vehicle) => {
      const documents = documentsByVehicle.get(vehicle.id) ?? [];
      const maintenance = maintenanceByVehicle.get(vehicle.id) ?? [];
      const tyres = tyresByVehicle.get(vehicle.id) ?? [];
      const vehicleBookings = bookingsByVehicle.get(vehicle.id) ?? [];
      const vehicleExpenses = expensesByVehicle.get(vehicle.id) ?? [];
      return [vehicle.id, {
        ok: true,
        vehicle: {
          id: vehicle.id,
          name: vehicle.name,
          make: vehicle.make,
          registrationNumber: vehicle.registrationNumber,
          imageUrl: vehicle.imageUrl,
          fuelType: vehicle.fuelType,
          transmission: vehicle.transmission,
          modelYear: vehicle.modelYear,
          dailyRate: vehicle.dailyRate,
          odometerKm: vehicle.odometerKm,
          allowedKmPerDay: vehicle.allowedKmPerDay,
          extraKmRate: vehicle.extraKmRate,
          mileageKmPerLitre: vehicle.mileageKmPerLitre,
          status: vehicle.status,
          createdAt: vehicle.createdAt.toISOString(),
          updatedAt: vehicle.updatedAt.toISOString(),
        },
        documents: documents.map((item) => ({
          id: item.id, documentType: item.documentType, documentNumber: item.documentNumber, expiryDate: item.expiryDate, notes: item.notes, updatedAt: item.updatedAt.toISOString(),
        })),
        maintenance: maintenance.map((item) => ({
          id: item.id, title: item.title, description: item.description, status: item.status, dueDate: item.dueDate, dueOdometerKm: item.dueOdometerKm, amount: item.amount, completedAt: item.completedAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(),
        })),
        tyres: tyres.map((item) => ({
          id: item.id, position: item.position, brand: item.brand, model: item.model, size: item.size, installedDate: item.installedDate, installedOdometerKm: item.installedOdometerKm, treadDepthMm: item.treadDepthMm, replacementDueDate: item.replacementDueDate, replacementDueOdometerKm: item.replacementDueOdometerKm, notes: item.notes, updatedAt: item.updatedAt.toISOString(),
        })),
        tyreWarning: tyreRows.length === 0 ? null : null,
        rentals: vehicleBookings.map(({ booking, customer }) => ({
          id: booking.id, bookingNumber: booking.bookingNumber, customer: customer.name, phone: customer.phone, startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString(), rentalDays: booking.rentalDays, dailyRate: booking.dailyRate, baseRentalAmount: booking.baseRentalAmount, otherCharges: booking.otherCharges, status: booking.status,
        })),
        expenses: vehicleExpenses.map(({ expense }) => ({
          id: expense.id, expenseNumber: expense.expenseNumber, expenseDate: expense.expenseDate, category: expense.category, amount: expense.amount, description: expense.description, method: expense.method,
        })),
      }];
    }));

    const customerDtos = customerRows.map((customer) => {
      const related = rentals.filter((rental) => rental.customerId === customer.id);
      const paid = paymentRows
        .filter((row) => row.customer.id === customer.id)
        .reduce((sum, row) => sum + row.payment.amount, 0);
      const pending = related.reduce((sum, rental) => sum + rental.balance, 0);
      const active = related.find((rental) => rental.state !== "completed");
      return {
        id: customer.id,
        name: customer.name,
        initials: initials(customer.name),
        phone: customer.phone,
        whatsappNumber: customer.whatsappNumber ?? customer.phone,
        city: customer.city ?? "—",
        licence: maskLicence(customer.drivingLicence),
        fullLicence: customer.drivingLicence,
        rentals: related.length,
        spent: roundMoney(paid),
        pending: roundMoney(pending),
        active: active?.vehicle ?? null,
        activeRentalId: active?.id ?? null,
        createdAt: customer.createdAt.toISOString(),
      };
    });

    const paymentDtos = paymentRows.slice(0, 100).map(({ payment, customer, booking }) => ({
      id: payment.paymentNumber,
      customer: customer.name,
      phone: customer.phone,
      rental: booking.bookingNumber,
      date: formatDateTime(payment.receivedAt, today),
      receivedAt: payment.receivedAt.toISOString(),
      amount: payment.amount,
      method: payment.method,
      type: payment.paymentType,
      receivedBy: payment.receivedBy,
      notes: payment.notes,
    }));

    const expenseDtos = expenseRows.slice(0, 100).map(({ expense, vehicle }) => ({
      id: expense.expenseNumber,
      rawDate: expense.expenseDate,
      date: formatShortDate(new Date(`${expense.expenseDate}T00:00:00+05:30`)),
      category: expense.category,
      vehicle: vehicle?.name ?? "—",
      vehicleId: vehicle?.id ?? null,
      description: expense.description ?? "—",
      method: expense.method,
      amount: expense.amount,
      createdBy: expense.createdBy,
    }));

    const activeRentals = rentals.filter((rental) => rental.state !== "completed");
    const returningToday = activeRentals.filter((rental) => rental.state === "today");
    const overdueRentals = activeRentals.filter((rental) => rental.state === "overdue");
    const outstandingRentals = rentals.filter((rental) => rental.balance > 0);
    const outstanding = roundMoney(outstandingRentals.reduce((sum, rental) => sum + rental.balance, 0));
    const availableCars = vehicleDtos.filter((vehicle) => vehicle.statusKey === "available").length;
    const maintenanceCars = vehicleDtos.filter((vehicle) => vehicle.statusKey === "maintenance").length;
    const onRentCars = vehicleDtos.filter((vehicle) => ["rented", "today", "overdue"].includes(vehicle.statusKey)).length;

    const paymentSum = (key: string) =>
      roundMoney(
        paymentRows
          .filter((row) => monthKey(row.payment.receivedAt) === key)
          .reduce((sum, row) => sum + row.payment.amount, 0),
      );
    const collectedToday = roundMoney(
      paymentRows.filter((row) => dateKey(row.payment.receivedAt) === today).reduce((sum, row) => sum + row.payment.amount, 0),
    );
    const collectedMonth = paymentSum(thisMonth);
    const collectedLastMonth = paymentSum(lastMonth);
    const expensesToday = roundMoney(
      expenseRows.filter((row) => row.expense.expenseDate === today).reduce((sum, row) => sum + row.expense.amount, 0),
    );
    const expensesMonth = roundMoney(
      expenseRows.filter((row) => row.expense.expenseDate.startsWith(thisMonth)).reduce((sum, row) => sum + row.expense.amount, 0),
    );
    const rentalRevenueMonth = roundMoney(
      rentals.filter((rental) => monthKey(new Date(rental.startAt)) === thisMonth).reduce((sum, rental) => sum + rental.total, 0),
    );
    const depositsHeld = roundMoney(
      bookingRows
        .filter((row) => ["booked", "rented"].includes(row.booking.status))
        .reduce((sum, row) => sum + row.booking.securityDeposit, 0),
    );
    const newCustomersThisMonth = customerRows.filter((customer) => monthKey(customer.createdAt) === thisMonth).length;
    const months = lastTwelveMonths(current);
    const monthlyCollected = months.map((month) => ({
      ...month,
      amount: paymentSum(month.key),
    }));
    const twelveMonthCollected = roundMoney(monthlyCollected.reduce((sum, month) => sum + month.amount, 0));
    const collectionChangePercent = collectedLastMonth > 0
      ? Math.round(((collectedMonth - collectedLastMonth) / collectedLastMonth) * 1000) / 10
      : collectedMonth > 0
        ? 100
        : 0;

    const reminders: { key: string; tone: string; type: string; title: string; text: string; rentalId?: string }[] = [];
    for (const rental of overdueRentals) {
      reminders.push({ key: `overdue:${rental.id}`, tone: "urgent", type: "overdue", title: `${rental.vehicle} is overdue`, text: rental.statusText, rentalId: rental.id });
    }
    for (const rental of returningToday) {
      reminders.push({ key: `today:${rental.id}`, tone: "upcoming", type: "today", title: `${rental.vehicle} returns today`, text: rental.returnDate, rentalId: rental.id });
    }
    for (const rental of outstandingRentals.sort((a, b) => b.balance - a.balance).slice(0, 2)) {
      reminders.push({ key: `payment:${rental.id}`, tone: "normal", type: "payment", title: `Payment pending from ${rental.customer}`, text: `${rental.id} · ₹${rental.balance.toLocaleString("en-IN")} due`, rentalId: rental.id });
    }
    for (const document of documentRows) {
      if (!document.expiryDate) continue;
      const expiry = new Date(`${document.expiryDate}T00:00:00+05:30`);
      const days = Math.ceil((expiry.getTime() - current.getTime()) / 86_400_000);
      if (days >= 0 && days <= 30) {
        const vehicle = vehicleRows.find((row) => row.id === document.vehicleId);
        if (vehicle) reminders.push({ key: `document:${document.id}`, tone: "upcoming", type: "document", title: `${vehicle.name} ${document.documentType} expires`, text: `Due in ${days} day${days === 1 ? "" : "s"}` });
      }
    }

    return Response.json({
      ok: true,
      generatedAt: current.toISOString(),
      rentals,
      vehicles: vehicleDtos,
      vehicleProfiles,
      customers: customerDtos,
      payments: paymentDtos,
      expenses: expenseDtos,
      reminders: reminders.slice(0, 8),
      metrics: {
        totalCars: vehicleDtos.length,
        availableCars,
        onRentCars,
        maintenanceCars,
        roadReadyPercent: vehicleDtos.length ? Math.round(((vehicleDtos.length - maintenanceCars) / vehicleDtos.length) * 100) : 0,
        activeRentals: activeRentals.length,
        returningToday: returningToday.length,
        overdue: overdueRentals.length,
        outstanding,
        outstandingRentals: outstandingRentals.length,
        outstandingCustomers: new Set(outstandingRentals.map((rental) => rental.customerId)).size,
        totalCustomers: customerDtos.length,
        newCustomersThisMonth,
        currentlyRentingCustomers: new Set(activeRentals.map((rental) => rental.customerId)).size,
        collectedToday,
        paymentsToday: paymentRows.filter((row) => dateKey(row.payment.receivedAt) === today).length,
        expensesToday,
        netToday: roundMoney(collectedToday - expensesToday),
        collectedMonth,
        collectedLastMonth,
        collectionChangePercent,
        rentalRevenueMonth,
        expensesMonth,
        netIncomeMonth: roundMoney(collectedMonth - expensesMonth),
        depositsHeld,
        twelveMonthCollected,
        monthlyCollected,
      },
    });
    });
  } catch (error) {
    if (error instanceof DatabaseConfigurationError) {
      return Response.json({ ok: false, error: error.message }, { status: 503 });
    }
    console.error("Could not load live Mecardee data", error);
    return Response.json({ ok: false, error: "Could not load live database data." }, { status: 500 });
  }
}
