// MECARDEE_LOCKED_RENTAL_EXPENSE_UI_V8_9_82
// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
// MECARDEE_ROLE_GUARD_V8_9_55
import { requireReadAccess } from "@/lib/mecardee-auth";
// MECARDEE_MOBILE_SETTINGS_REMINDERS_CURRENT_RENTAL_V8_9_51
// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
import { asc, desc, eq } from "drizzle-orm";
import { DatabaseConfigurationError, withRequestDb } from "@/db";
import {
  bookings,
  customers,
  expenses,
  maintenanceRecords,
  payments,
  rentalSegments,
  returnSettlements,
  vehicleDocuments,
  vehicleTyres,
  vehicles,
} from "@/db/schema";
import { calculateSegmentCharge } from "@/lib/rental-segments";
import { normalisePendingBalance } from "@/lib/rental-calculations";

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

const calendarDayDistance = (fromKey: string, toKey: string) => {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

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
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

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
  const __mecardeeAuth = await requireReadAccess();
  if (!__mecardeeAuth.ok) return __mecardeeAuth.response;
  try {
    return await withRequestDb(async (db) => {
      const [
        vehicleRows,
        customerRows,
        bookingRows,
        settlementRows,
        paymentRows,
        expenseRows,
        documentRows,
        maintenanceRows,
        segmentRows,
      ] = await Promise.all([
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
        db
          .select({ segment: rentalSegments, vehicle: vehicles })
          .from(rentalSegments)
          .innerJoin(vehicles, eq(rentalSegments.vehicleId, vehicles.id))
          .orderBy(asc(rentalSegments.sequence)),
      ]);

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
      const bookingById = new Map(bookingRows.map((row) => [row.booking.id, row]));
      const vehicleById = new Map(vehicleRows.map((vehicle) => [vehicle.id, vehicle]));

      const paymentsByBooking = new Map<string, number>();
      for (const row of paymentRows) {
        paymentsByBooking.set(
          row.payment.bookingId,
          roundMoney((paymentsByBooking.get(row.payment.bookingId) ?? 0) + row.payment.amount),
        );
      }

      const segmentsByBooking = new Map<string, typeof segmentRows>();
      const segmentsByVehicle = new Map<string, typeof segmentRows>();
      for (const row of segmentRows) {
        const bookingSegments = segmentsByBooking.get(row.segment.bookingId) ?? [];
        bookingSegments.push(row);
        segmentsByBooking.set(row.segment.bookingId, bookingSegments);
        const vehicleSegments = segmentsByVehicle.get(row.segment.vehicleId) ?? [];
        vehicleSegments.push(row);
        segmentsByVehicle.set(row.segment.vehicleId, vehicleSegments);
      }

      const activeSegmentByVehicle = new Map<string, (typeof segmentRows)[number]>();
      for (const row of segmentRows) {
        if (row.segment.status === "active") activeSegmentByVehicle.set(row.segment.vehicleId, row);
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
      const expensesByVehicle = new Map<string, typeof expenseRows>();
      for (const expenseRow of expenseRows) {
        if (!expenseRow.expense.vehicleId) continue;
        const rows = expensesByVehicle.get(expenseRow.expense.vehicleId) ?? [];
        rows.push(expenseRow);
        expensesByVehicle.set(expenseRow.expense.vehicleId, rows);
      }

      const rentalsBase = bookingRows
        .filter((row) => ["rented", "completed"].includes(row.booking.status))
        .map((row) => {
          const { booking, vehicle: bookedVehicle, customer } = row;
          const originalVehicle = vehicleById.get(booking.requestedVehicleId) ?? bookedVehicle;
          const settlement = settlementByBooking.get(booking.id);
          const paid = roundMoney(paymentsByBooking.get(booking.id) ?? 0);
          const rows = [...(segmentsByBooking.get(booking.id) ?? [])].sort((a, b) => a.segment.sequence - b.segment.sequence);
          const activeSegment = [...rows].reverse().find((item) => item.segment.status === "active");
          const currentRow = activeSegment ?? rows.at(-1) ?? null;
          const actualVehicle = currentRow?.vehicle ?? bookedVehicle;
          const actualSegment = currentRow?.segment ?? null;

          const segmentDtos = rows.map((item) => {
            const isActive = item.segment.status === "active";
            const projectedEnd = isActive
              ? (booking.endAt.getTime() > item.segment.startAt.getTime() ? booking.endAt : current)
              : (item.segment.endAt ?? booking.endAt);
            const projected = isActive
              ? calculateSegmentCharge({
                  startAt: item.segment.startAt,
                  endAt: projectedEnd,
                  dailyRate: item.segment.dailyRate,
                  startingKilometer: item.segment.startingKilometer,
                  endingKilometer: item.segment.startingKilometer,
                  allowedKmPerDay: item.segment.allowedKmPerDay,
                  extraKmRate: item.segment.extraKmRate,
                })
              : null;
            return {
              id: item.segment.id,
              sequence: item.segment.sequence,
              vehicleId: item.vehicle.id,
              vehicle: item.vehicle.name,
              plate: item.vehicle.registrationNumber,
              image: item.vehicle.imageUrl ?? "/cars/swift.jpg",
              isGuest: item.vehicle.isGuest,
              startAt: item.segment.startAt.toISOString(),
              endAt: item.segment.endAt?.toISOString() ?? null,
              start: formatDateTime(item.segment.startAt, today),
              end: item.segment.endAt ? formatDateTime(item.segment.endAt, today) : "Current vehicle",
              startingKilometer: item.segment.startingKilometer,
              endingKilometer: item.segment.endingKilometer,
              startingFuelRangeKm: item.segment.startingFuelRangeKm,
              returnFuelRangeKm: item.segment.returnFuelRangeKm,
              fuelRangeShortageKm: item.segment.fuelRangeShortageKm,
              fuelPricePerLitre: item.segment.fuelPricePerLitre,
              fuelCharge: item.segment.fuelCharge,
              dailyRate: item.segment.dailyRate,
              rentalDays: projected?.rentalDays ?? item.segment.rentalDays,
              rentalCharge: projected?.rentalCharge ?? item.segment.rentalCharge,
              extraKilometers: item.segment.extraKilometers,
              extraKmCharge: item.segment.extraKmCharge,
              status: item.segment.status,
            };
          });

          const replacementFlow = segmentDtos.length > 1 || segmentDtos.some((segment) => segment.vehicleId !== booking.requestedVehicleId);
          const segmentGross = roundMoney(segmentDtos.reduce((sum, segment) => sum + segment.rentalCharge, 0));
          const segmentExtraKm = roundMoney(segmentDtos.reduce((sum, segment) => sum + segment.extraKmCharge, 0));
          const settledRentalDays = booking.status === "completed" && settlement
            ? Math.max(1, segmentDtos.reduce((sum, segment) => sum + segment.rentalDays, 0))
            : booking.rentalDays;
          const displayedRentalAmount = booking.status === "completed" && settlement
            ? segmentGross
            : replacementFlow
              ? segmentGross
              : booking.baseRentalAmount + booking.bookingDiscount;
          const displayedDiscount = roundMoney(booking.bookingDiscount + (settlement?.discountAmount ?? 0));
          const settlementRentalAmount = settlement
            ? roundMoney(Math.max(0,
                settlement.subtotal
                - booking.otherCharges
                - segmentExtraKm
                - settlement.fuelCharge
                - settlement.lateFee
                - settlement.cleaningCharge
                - settlement.damageCharge,
              ))
            : null;
          const guestRentalAmount = roundMoney(segmentDtos.filter((segment) => segment.isGuest).reduce((sum, segment) => sum + segment.rentalCharge + segment.extraKmCharge + segment.fuelCharge, 0));

          const chargeableLateMs = booking.status === "completed"
            ? 0
            : Math.max(0, current.getTime() - booking.endAt.getTime() - 3 * 60 * 60 * 1000);
          const liveLateRentalDays = chargeableLateMs > 0 ? Math.ceil(chargeableLateMs / 86_400_000) : 0;
          const currentRate = actualSegment?.dailyRate ?? booking.dailyRate;
          const liveLateRentalCharge = roundMoney(liveLateRentalDays * currentRate);
          const settledLateRentalCharge = settlement?.lateFee ?? 0;
          const lateRentalCharge = settlement ? settledLateRentalCharge : liveLateRentalCharge;
          const lateRentalDays = settlement
            ? (lateRentalCharge > 0 ? Math.max(1, Math.ceil(lateRentalCharge / Math.max(1, currentRate))) : 0)
            : liveLateRentalDays;

          const baseRentalAmount = replacementFlow
            ? roundMoney(Math.max(0, segmentGross - Math.min(booking.bookingDiscount, segmentGross)))
            : booking.baseRentalAmount;
          const liveTotal = roundMoney(baseRentalAmount + booking.otherCharges + segmentExtraKm + liveLateRentalCharge);
          const total = roundMoney(settlement?.finalAmount ?? liveTotal);
          const balance = normalisePendingBalance(total - paid);
          const businessFinancialTotal = roundMoney(Math.max(0, total - guestRentalAmount));

          let state: "active" | "today" | "overdue" | "completed" = "active";
          let statusText = "Active";
          if (booking.status === "completed") {
            state = "completed";
            statusText = balance > 0 ? "Completed · balance due" : "Completed";
          } else if (current.getTime() > booking.endAt.getTime() + 3 * 60 * 60 * 1000) {
            state = "overdue";
            const days = Math.max(1, Math.ceil((current.getTime() - booking.endAt.getTime() - 3 * 60 * 60 * 1000) / 86_400_000));
            statusText = `Overdue · ${days} extra rental day${days === 1 ? "" : "s"}`;
          } else if (current.getTime() > booking.endAt.getTime()) {
            state = "today";
            statusText = "Return grace period · up to 3 hours";
          } else if (dateKey(booking.endAt) === today) {
            state = "today";
            statusText = "Returning today";
          } else {
            const remainingFrom = Math.max(current.getTime(), booking.startAt.getTime());
            const days = Math.max(1, Math.ceil((booking.endAt.getTime() - remainingFrom) / 86_400_000));
            statusText = `${days} day${days === 1 ? "" : "s"} remaining`;
          }

          const duration = Math.max(1, booking.endAt.getTime() - booking.startAt.getTime());
          const progress = booking.status === "completed"
            ? 100
            : Math.max(0, Math.min(100, Math.round(((current.getTime() - booking.startAt.getTime()) / duration) * 100)));

          return {
            id: booking.bookingNumber,
            databaseId: booking.id,
            vehicleId: actualVehicle.id,
            customerId: customer.id,
            vehicle: actualVehicle.name,
            plate: actualVehicle.registrationNumber,
            image: actualVehicle.imageUrl ?? "/cars/swift.jpg",
            isGuestCurrent: actualVehicle.isGuest,
            originalVehicleId: originalVehicle.id,
            originalVehicle: originalVehicle.name,
            originalPlate: originalVehicle.registrationNumber,
            originalStartAt: booking.startAt.toISOString(),
            originalEndAt: booking.endAt.toISOString(),
            originalDays: booking.rentalDays,
            replacementUsed: replacementFlow,
            segments: segmentDtos,
            customer: customer.name,
            city: customer.city ?? "—",
            phone: customer.phone,
            whatsappNumber: customer.whatsappNumber ?? customer.phone,
            licence: customer.drivingLicence,
            start: formatDateTime(booking.startAt, today),
            returnDate: formatDateTime(booking.status === "completed" && settlement?.actualReturnAt ? settlement.actualReturnAt : booking.endAt, today),
            startAt: booking.startAt.toISOString(),
            endAt: booking.endAt.toISOString(),
            actualReturnAt: settlement?.actualReturnAt?.toISOString() ?? null,
            days: settledRentalDays,
            rate: currentRate,
            rentalAmount: displayedRentalAmount,
            bookingDiscount: displayedDiscount,
            storedOtherCharges: booking.otherCharges,
            otherCharges: settlement
              ? booking.otherCharges + segmentExtraKm + settlement.fuelCharge + settlement.lateFee + settlement.cleaningCharge + settlement.damageCharge
              : booking.otherCharges + segmentExtraKm + liveLateRentalCharge,
            lateRentalDays,
            lateRentalCharge,
            total,
            businessFinancialTotal,
            guestRentalAmount,
            paid,
            balance,
            securityDeposit: booking.securityDeposit,
            state,
            statusText,
            progress,
            startingKilometer: actualSegment?.startingKilometer ?? booking.startingKilometer ?? actualVehicle.odometerKm,
            returnKilometer: settlement?.actualReturnKilometer ?? actualSegment?.endingKilometer ?? null,
            settlement: settlement ? {
              actualReturnAt: settlement.actualReturnAt.toISOString(),
              actualReturnKilometer: settlement.actualReturnKilometer,
              allowedKilometers: settlement.allowedKilometers,
              expectedReturnKilometer: settlement.expectedReturnKilometer,
              extraKilometers: settlement.extraKilometers,
              extraKmRate: settlement.extraKmRate,
              extraKmCharge: settlement.extraKmCharge,
              totalExtraKilometers: segmentDtos.reduce((sum, segment) => sum + segment.extraKilometers, 0),
              totalExtraKmCharge: segmentExtraKm,
              startingFuelRangeKm: settlement.startingFuelRangeKm,
              returnFuelRangeKm: settlement.returnFuelRangeKm,
              fuelRangeShortageKm: settlement.fuelRangeShortageKm,
              mileageKmPerLitre: settlement.mileageKmPerLitre,
              requiredFuelLitres: settlement.requiredFuelLitres,
              fuelPricePerLitre: settlement.fuelPricePerLitre,
              fuelCharge: settlement.fuelCharge,
              existingCharges: booking.otherCharges,
              lateFee: settlement.lateFee,
              cleaningCharge: settlement.cleaningCharge,
              damageCharge: settlement.damageCharge,
              additionalCharge: roundMoney(settlement.cleaningCharge + settlement.damageCharge),
              additionalDescription: settlement.returnNotes,
              vehicleCondition: settlement.vehicleCondition,
              rentalAmount: settlementRentalAmount ?? 0,
              subtotal: settlement.subtotal,
              bookingDiscount: booking.bookingDiscount,
              discountAmount: settlement.discountAmount,
              discountRemark: settlement.discountRemark,
              finalAmount: settlement.finalAmount,
              sendToMaintenance: settlement.sendToMaintenance,
              confirmedAt: settlement.confirmedAt.toISOString(),
            } : null,
            startingFuelRangeKm: actualSegment?.startingFuelRangeKm ?? booking.startingFuelRangeKm ?? 0,
            allowedKmPerDay: actualSegment?.allowedKmPerDay ?? actualVehicle.allowedKmPerDay,
            extraKmRate: actualSegment?.extraKmRate ?? actualVehicle.extraKmRate,
            mileageKmPerLitre: actualVehicle.mileageKmPerLitre,
          };
        });

      const guestRemainingByBooking = new Map(
        rentalsBase.map((rental) => [rental.databaseId, Math.min(rental.guestRentalAmount, rental.paid)]),
      );
      const businessPaymentByPaymentId = new Map<string, number>();
      const businessPaidByBooking = new Map<string, number>();
      // paymentRows are newest-first. Exclude the Guest Car portion from the newest
      // receipts first so the total main-business cash is correct without changing
      // any stored customer payment.
      for (const row of paymentRows) {
        const guestRemaining = guestRemainingByBooking.get(row.payment.bookingId) ?? 0;
        const excluded = Math.min(row.payment.amount, guestRemaining);
        const businessAmount = roundMoney(Math.max(0, row.payment.amount - excluded));
        guestRemainingByBooking.set(row.payment.bookingId, roundMoney(Math.max(0, guestRemaining - excluded)));
        businessPaymentByPaymentId.set(row.payment.id, businessAmount);
        businessPaidByBooking.set(
          row.payment.bookingId,
          roundMoney((businessPaidByBooking.get(row.payment.bookingId) ?? 0) + businessAmount),
        );
      }

      const rentals = rentalsBase.map((rental) => {
        const businessPaid = businessPaidByBooking.get(rental.databaseId) ?? 0;
        return {
          ...rental,
          businessPaid,
          businessBalance: normalisePendingBalance(rental.businessFinancialTotal - businessPaid),
        };
      });
      const rentalByDatabaseId = new Map(rentals.map((rental) => [rental.databaseId, rental]));
      const rentalById = new Map(rentals.map((rental) => [rental.id, rental]));

      const reservations = bookingRows
        .filter((row) => row.booking.status === "booked")
        .map(({ booking, vehicle, customer }) => {
          const requestedVehicle = vehicleById.get(booking.requestedVehicleId) ?? vehicle;
          return {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            vehicleId: vehicle.id,
            vehicle: vehicle.name,
            plate: vehicle.registrationNumber,
            image: vehicle.imageUrl ?? "/cars/swift.jpg",
            requestedVehicleId: requestedVehicle.id,
            requestedVehicle: requestedVehicle.name,
            requestedPlate: requestedVehicle.registrationNumber,
            replacementBooked: requestedVehicle.id !== vehicle.id,
            customerId: customer.id,
            customer: customer.name,
            phone: customer.phone,
            whatsappNumber: customer.whatsappNumber ?? customer.phone,
            city: customer.city ?? "",
            startAt: booking.startAt.toISOString(),
            endAt: booking.endAt.toISOString(),
            start: formatDateTime(booking.startAt, today),
            returnDate: formatDateTime(booking.endAt, today),
            days: booking.rentalDays,
            rate: booking.dailyRate,
            amount: roundMoney(booking.baseRentalAmount + booking.bookingDiscount),
            createdAt: booking.createdAt.toISOString(),
          };
        });

      const bookingHistory = bookingRows
        .filter((row) => row.booking.status !== "draft")
        .map(({ booking, vehicle, customer }) => {
          const requestedVehicle = vehicleById.get(booking.requestedVehicleId) ?? vehicle;
          const settlement = settlementByBooking.get(booking.id);
          const rental = rentalByDatabaseId.get(booking.id);
          const paid = roundMoney(paymentsByBooking.get(booking.id) ?? booking.advancePaid ?? 0);
          const totalAmount = rental?.total ?? roundMoney(settlement?.finalAmount ?? booking.baseRentalAmount + booking.otherCharges);
          return {
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            vehicleId: vehicle.id,
            vehicle: vehicle.name,
            plate: vehicle.registrationNumber,
            image: vehicle.imageUrl ?? "/cars/swift.jpg",
            requestedVehicleId: requestedVehicle.id,
            requestedVehicle: requestedVehicle.name,
            requestedPlate: requestedVehicle.registrationNumber,
            replacementBooked: requestedVehicle.id !== vehicle.id,
            customerId: customer.id,
            customer: customer.name,
            phone: customer.phone,
            whatsappNumber: customer.whatsappNumber ?? customer.phone,
            city: customer.city ?? "",
            startAt: booking.startAt.toISOString(),
            endAt: booking.endAt.toISOString(),
            start: formatDateTime(booking.startAt, today),
            returnDate: formatDateTime(booking.status === "completed" && settlement?.actualReturnAt ? settlement.actualReturnAt : booking.endAt, today),
            days: booking.status === "completed" && rental ? rental.days : booking.rentalDays,
            rate: booking.dailyRate,
            amount: totalAmount,
            advancePaid: roundMoney(booking.advancePaid ?? 0),
            paid,
            balance: roundMoney(Math.max(0, totalAmount - paid)),
            status: booking.status,
            createdAt: booking.createdAt.toISOString(),
          };
        });

      const vehicleDtosAll = vehicleRows.map((vehicle) => {
        const activeSegment = activeSegmentByVehicle.get(vehicle.id);
        const activeBooking = activeSegment ? bookingById.get(activeSegment.segment.bookingId) : undefined;
        const activeRental = activeBooking ? rentalById.get(activeBooking.booking.bookingNumber) : undefined;
        let statusKey = vehicle.status.toLowerCase();
        let status = vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1);
        let note = statusKey === "available" ? "Ready to rent" : "Currently with customer";

        if (vehicle.status === "maintenance" && !vehicle.isGuest) {
          statusKey = "maintenance";
          status = "Maintenance";
          const openMaintenance = (maintenanceByVehicle.get(vehicle.id) ?? []).find((record) => record.status === "open");
          note = openMaintenance?.title ?? "Maintenance in progress";
        } else if (vehicle.status === "inactive") {
          statusKey = "inactive";
          status = "Inactive";
          note = "Manually disabled";
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
        } else if (statusKey === "rented") {
          // Do not leave a vehicle visually stuck on rent when no active segment uses it.
          statusKey = "available";
          status = "Available";
          note = "Ready to rent";
        }

        let docs = vehicle.isGuest ? "Guest Car · basic details only" : "All documents current";
        if (!vehicle.isGuest) {
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
          isGuest: vehicle.isGuest,
          guestOwnerName: vehicle.guestOwnerName ?? "",
          guestOwnerPlace: vehicle.guestOwnerPlace ?? "",
        };
      });

      const ownVehicleDtos = vehicleDtosAll.filter((vehicle) => !vehicle.isGuest);
      const guestVehicleDtos = vehicleDtosAll.filter((vehicle) => vehicle.isGuest);

      const vehicleProfiles = Object.fromEntries(vehicleRows.map((vehicle) => {
        const isGuest = vehicle.isGuest;
        const documents = isGuest ? [] : (documentsByVehicle.get(vehicle.id) ?? []);
        const maintenance = isGuest ? [] : (maintenanceByVehicle.get(vehicle.id) ?? []);
        const tyres = isGuest ? [] : (tyresByVehicle.get(vehicle.id) ?? []);
        const vehicleExpenses = isGuest ? [] : (expensesByVehicle.get(vehicle.id) ?? []);
        const vehicleSegmentRows = [...(segmentsByVehicle.get(vehicle.id) ?? [])].sort((a, b) => b.segment.startAt.getTime() - a.segment.startAt.getTime());

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
            isGuest,
            guestOwnerName: vehicle.guestOwnerName,
            guestOwnerPlace: vehicle.guestOwnerPlace,
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
          tyreWarning: null,
          rentals: vehicleSegmentRows.map(({ segment }) => {
            const linked = bookingById.get(segment.bookingId);
            const endAt = segment.endAt ?? linked?.booking.endAt ?? current;
            const projected = segment.status === "active"
              ? calculateSegmentCharge({
                  startAt: segment.startAt,
                  endAt,
                  dailyRate: segment.dailyRate,
                  startingKilometer: segment.startingKilometer,
                  endingKilometer: segment.startingKilometer,
                  allowedKmPerDay: segment.allowedKmPerDay,
                  extraKmRate: segment.extraKmRate,
                })
              : null;
            return {
              id: segment.id,
              bookingNumber: linked?.booking.bookingNumber ?? "Rental",
              customer: linked?.customer ? `${linked.customer.name}${linked.customer.city ? ` · ${linked.customer.city}` : ""}` : "—",
              phone: linked?.customer.phone ?? "—",
              startAt: segment.startAt.toISOString(),
              endAt: endAt.toISOString(),
              rentalDays: projected?.rentalDays ?? segment.rentalDays,
              dailyRate: segment.dailyRate,
              baseRentalAmount: projected?.rentalCharge ?? segment.rentalCharge,
              otherCharges: segment.extraKmCharge,
              status: linked?.booking.status ?? segment.status,
            };
          }),
          expenses: vehicleExpenses.map(({ expense }) => ({
            id: expense.id, expenseNumber: expense.expenseNumber, expenseDate: expense.expenseDate, category: expense.category, amount: expense.amount, description: expense.description, method: expense.method,
          })),
        }];
      }));

      const customerDtos = customerRows.map((customer) => {
        const related = rentals.filter((rental) => rental.customerId === customer.id);
        const paid = paymentRows.filter((row) => row.customer.id === customer.id).reduce((sum, row) => sum + row.payment.amount, 0);
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

      const businessPaymentRows = paymentRows
        .map((row) => ({ ...row, businessAmount: businessPaymentByPaymentId.get(row.payment.id) ?? row.payment.amount }))
        .filter((row) => row.businessAmount > 0);

      const paymentDtos = businessPaymentRows.slice(0, 100).map(({ payment, customer, booking, businessAmount }) => {
        const rental = rentalByDatabaseId.get(booking.id);
        const vehicleLabels = rental?.segments.length
          ? [...new Set(rental.segments.map((segment) => `${segment.vehicle} (${segment.plate})`))]
          : [`${vehicleById.get(booking.requestedVehicleId)?.name ?? "Vehicle"} (${vehicleById.get(booking.requestedVehicleId)?.registrationNumber ?? "—"})`];
        return {
          id: payment.paymentNumber,
          customer: customer.name,
          phone: customer.phone,
          place: customer.city ?? "—",
          rental: booking.bookingNumber,
          vehicle: vehicleLabels.join(" → "),
          date: formatDateTime(payment.receivedAt, today),
          receivedAt: payment.receivedAt.toISOString(),
          amount: businessAmount,
          actualAmount: payment.amount,
          method: payment.method,
          type: payment.paymentType,
          receivedBy: payment.receivedBy,
          notes: payment.notes,
        };
      });

      const expenseDtos = expenseRows.slice(0, 100).map(({ expense, vehicle }) => ({
        id: expense.expenseNumber,
        rawDate: expense.expenseDate,
        date: formatShortDate(new Date(`${expense.expenseDate}T00:00:00+05:30`)),
        category: expense.category,
        vehicle: vehicle?.name ?? "—",
        vehicleId: vehicle?.id ?? null,
        bookingId: expense.bookingId ?? null,
        description: expense.description ?? "—",
        method: expense.method,
        amount: expense.amount,
        createdBy: expense.createdBy,
      }));

      const activeRentals = rentals.filter((rental) => rental.state !== "completed");
      const returningToday = activeRentals.filter((rental) => rental.state === "today");
      const overdueRentals = activeRentals.filter((rental) => rental.state === "overdue");
      // Main dashboard/payment/accounting totals intentionally exclude Guest Car rental amounts.
      // Customer-facing rental.balance remains the real amount due and is still used by settlement/reminders.
      const businessOutstandingRentals = rentals.filter((rental) => rental.businessBalance > 0);
      const outstanding = roundMoney(businessOutstandingRentals.reduce((sum, rental) => sum + rental.businessBalance, 0));
      const availableCars = ownVehicleDtos.filter((vehicle) => vehicle.statusKey === "available").length;
      const maintenanceCars = ownVehicleDtos.filter((vehicle) => vehicle.statusKey === "maintenance").length;
      const onRentCars = ownVehicleDtos.filter((vehicle) => ["rented", "today", "overdue"].includes(vehicle.statusKey)).length;

      const businessPaymentSum = (key: string) =>
        roundMoney(
          businessPaymentRows
            .filter((row) => monthKey(row.payment.receivedAt) === key)
            .reduce((sum, row) => sum + row.businessAmount, 0),
        );

      const collectedToday = roundMoney(
        businessPaymentRows
          .filter((row) => dateKey(row.payment.receivedAt) === today)
          .reduce((sum, row) => sum + row.businessAmount, 0),
      );
      const collectedMonth = businessPaymentSum(thisMonth);
      const collectedLastMonth = businessPaymentSum(lastMonth);
      const expensesToday = roundMoney(
        expenseRows.filter((row) => row.expense.expenseDate === today).reduce((sum, row) => sum + row.expense.amount, 0),
      );
      const expensesMonth = roundMoney(
        expenseRows.filter((row) => row.expense.expenseDate.startsWith(thisMonth)).reduce((sum, row) => sum + row.expense.amount, 0),
      );
      const rentalRevenueMonth = roundMoney(
        rentals
          .filter((rental) => monthKey(new Date(rental.startAt)) === thisMonth)
          .reduce((sum, rental) => sum + rental.businessFinancialTotal, 0),
      );
      const depositsHeld = roundMoney(
        bookingRows.filter((row) => row.booking.status === "rented").reduce((sum, row) => sum + row.booking.securityDeposit, 0),
      );
      const newCustomersThisMonth = customerRows.filter((customer) => monthKey(customer.createdAt) === thisMonth).length;
      const months = lastTwelveMonths(current);
      const monthlyCollected = months.map((month) => ({ ...month, amount: businessPaymentSum(month.key) }));
      const twelveMonthCollected = roundMoney(monthlyCollected.reduce((sum, month) => sum + month.amount, 0));
      const collectionChangePercent = collectedLastMonth > 0
        ? Math.round(((collectedMonth - collectedLastMonth) / collectedLastMonth) * 1000) / 10
        : collectedMonth > 0 ? 100 : 0;

      const reminders: { key: string; tone: string; type: string; title: string; text: string; rentalId?: string; reservationId?: string }[] = [];
      for (const rental of overdueRentals) {
        reminders.push({ key: `overdue:${rental.id}`, tone: "urgent", type: "overdue", title: `${rental.vehicle} is overdue`, text: rental.statusText, rentalId: rental.id });
      }
      for (const rental of returningToday) {
        reminders.push({ key: `today:${rental.id}`, tone: "upcoming", type: "today", title: `${rental.vehicle} returns today`, text: rental.returnDate, rentalId: rental.id });
      }
      for (const reservation of reservations) {
        const pickupAt = new Date(reservation.startAt);
        const daysUntilBooking = calendarDayDistance(today, dateKey(pickupAt));
        if (daysUntilBooking < 0 || daysUntilBooking > 2) continue;

        const pickupTime = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }).format(pickupAt);

        const pickupPassed = pickupAt.getTime() <= current.getTime();
        const title = daysUntilBooking === 0
          ? (pickupPassed ? "Booking pickup due — add rental" : `Booking at ${pickupTime} — add rental`)
          : daysUntilBooking === 1
            ? `Booking tomorrow at ${pickupTime}`
            : `Booking in 2 days at ${pickupTime}`;

        reminders.push({
          key: `booking:${reservation.id}`,
          tone: daysUntilBooking === 0 && pickupPassed ? "urgent" : "upcoming",
          type: "booking",
          title,
          text: [reservation.vehicle, reservation.customer, reservation.city].filter(Boolean).join(" · "),
          reservationId: reservation.id,
        });
      }
      // Current active rental amounts are operational values, not reminder "dues".
      // Payment-pending reminders are intentionally omitted from Dashboard reminders.
      for (const document of documentRows) {
        if (!document.expiryDate) continue;
        const vehicle = vehicleRows.find((row) => row.id === document.vehicleId);
        if (!vehicle || vehicle.isGuest) continue;
        const expiry = new Date(`${document.expiryDate}T00:00:00+05:30`);
        const days = Math.ceil((expiry.getTime() - current.getTime()) / 86_400_000);
        if (days >= 0 && days <= 30) {
          reminders.push({ key: `document:${document.id}`, tone: "upcoming", type: "document", title: `${vehicle.name} ${document.documentType} expires`, text: `Due in ${days} day${days === 1 ? "" : "s"}` });
        }
      }

      return Response.json({
        ok: true,
        generatedAt: current.toISOString(),
        rentals,
        reservations,
        bookings: bookingHistory,
        vehicles: ownVehicleDtos,
        guestVehicles: guestVehicleDtos,
        vehicleProfiles,
        customers: customerDtos,
        payments: paymentDtos,
        expenses: expenseDtos,
        reminders: reminders.slice(0, 8),
        metrics: {
          totalCars: ownVehicleDtos.length,
          availableCars,
          onRentCars,
          maintenanceCars,
          roadReadyPercent: ownVehicleDtos.length ? Math.round(((availableCars + onRentCars) / ownVehicleDtos.length) * 100) : 0,
          activeRentals: activeRentals.length,
          returningToday: returningToday.length,
          overdue: overdueRentals.length,
          outstanding,
          outstandingRentals: businessOutstandingRentals.length,
          outstandingCustomers: new Set(businessOutstandingRentals.map((rental) => rental.customerId)).size,
          totalCustomers: customerDtos.length,
          newCustomersThisMonth,
          currentlyRentingCustomers: new Set(activeRentals.map((rental) => rental.customerId)).size,
          collectedToday,
          paymentsToday: businessPaymentRows.filter((row) => dateKey(row.payment.receivedAt) === today).length,
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
