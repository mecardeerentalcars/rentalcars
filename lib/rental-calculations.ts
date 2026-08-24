// MECARDEE_SEGMENT_FUEL_FINAL_SETTLEMENT_V8_9_45
export type SettlementCalculationInput = {
  baseRentalAmount: number;
  existingOtherCharges?: number;
  rentalDays: number;
  startingKilometer: number;
  actualReturnKilometer: number;
  allowedKmPerDay: number;
  extraKmRate: number;
  startingFuelRangeKm: number;
  returnFuelRangeKm: number;
  mileageKmPerLitre: number;
  fuelPricePerLitre: number;
  lateFee?: number;
  cleaningCharge?: number;
  damageCharge?: number;
  discountAmount?: number;
  amountAlreadyPaid?: number;
};

export type SettlementCalculation = {
  allowedKilometers: number;
  expectedReturnKilometer: number;
  extraKilometers: number;
  extraKmCharge: number;
  fuelRangeShortageKm: number;
  requiredFuelLitres: number;
  fuelCharge: number;
  additionalCharges: number;
  subtotal: number;
  discountAmount: number;
  finalAmount: number;
  amountDue: number;
};

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const indiaCalendarDateParts = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day") };
};

/** Rental days follow the calendar dates shown to staff in India. */
export function rentalDaysFromSchedule(startAt: string | Date, endAt: string | Date) {
  const start = indiaCalendarDateParts(startAt);
  const end = indiaCalendarDateParts(endAt);
  if (!start || !end) return 1;
  const startDay = Date.UTC(start.year, start.month - 1, start.day);
  const endDay = Date.UTC(end.year, end.month - 1, end.day);
  return Math.max(1, Math.round((endDay - startDay) / 86_400_000));
}

/** Amounts below one rupee are treated as settled, not as a pending balance. */
export function normalisePendingBalance(value: number) {
  const balance = roundMoney(nonNegative(value));
  return balance < 1 ? 0 : balance;
}

export function calculateFuelShortageCharge(
  startingFuelRangeKm: number,
  returnFuelRangeKm: number,
  mileageKmPerLitre: number,
  fuelPricePerLitre: number,
) {
  const fuelRangeShortageKm = Math.max(0, Math.round(startingFuelRangeKm - returnFuelRangeKm));
  const mileage = nonNegative(mileageKmPerLitre);
  const requiredFuelLitres =
    mileage > 0 ? Math.round((fuelRangeShortageKm / mileage) * 1000) / 1000 : 0;
  return {
    fuelRangeShortageKm,
    requiredFuelLitres,
    fuelCharge: roundMoney(requiredFuelLitres * nonNegative(fuelPricePerLitre)),
  };
}


export type LateRentalCharge = {
  graceHours: number;
  lateMilliseconds: number;
  extraRentalDays: number;
  charge: number;
};

export type ActualReturnRentalCharge = {
  isEarlyReturn: boolean;
  chargeableRentalDays: number;
  baseRentalAmount: number;
  amountSaved: number;
};

/**
 * Recalculate only the rental portion for an early return. Each started
 * 24-hour period counts as one rental day, with a minimum of one day.
 * For on-time or late returns the existing booked base rental amount is kept.
 * The booking itself is not mutated; this is intended for final settlement.
 */
export function calculateRentalChargeForActualReturn(
  startAt: string | Date,
  expectedReturnAt: string | Date,
  actualReturnAt: string | Date,
  dailyRate: number,
  bookedRentalDays: number,
  bookedBaseRentalAmount: number,
  graceHours = 3,
): ActualReturnRentalCharge {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const expected = expectedReturnAt instanceof Date ? expectedReturnAt : new Date(expectedReturnAt);
  const actual = actualReturnAt instanceof Date ? actualReturnAt : new Date(actualReturnAt);
  const bookedDays = Math.max(1, Math.round(nonNegative(bookedRentalDays)));
  const currentBase = roundMoney(nonNegative(bookedBaseRentalAmount));

  if ([start, expected, actual].some((value) => Number.isNaN(value.getTime())) || actual.getTime() >= expected.getTime()) {
    return { isEarlyReturn: false, chargeableRentalDays: bookedDays, baseRentalAmount: currentBase, amountSaved: 0 };
  }

  const elapsedMs = Math.max(0, actual.getTime() - start.getTime());
  // Apply the same cooling/grace window at every rental-day boundary.
  // Example: start 10:00 AM -> day 2 starts only after 1:00 PM the next day.
  // At exactly 1:00 PM the previous day's rate still applies; 1:01 PM starts
  // the next chargeable day. This is only used inside final settlement and
  // never mutates the original booking schedule.
  const graceMs = Math.max(0, graceHours) * 60 * 60 * 1000;
  const chargeableElapsedMs = Math.max(0, elapsedMs - graceMs);
  const chargeableRentalDays = Math.min(bookedDays, Math.max(1, Math.ceil(chargeableElapsedMs / 86_400_000)));
  const bookedGross = roundMoney(bookedDays * nonNegative(dailyRate));
  const bookingDiscount = roundMoney(Math.max(0, bookedGross - currentBase));
  const adjustedGross = roundMoney(chargeableRentalDays * nonNegative(dailyRate));
  const adjustedBase = roundMoney(Math.max(0, adjustedGross - Math.min(bookingDiscount, adjustedGross)));

  return {
    isEarlyReturn: true,
    chargeableRentalDays,
    baseRentalAmount: adjustedBase,
    amountSaved: roundMoney(Math.max(0, currentBase - adjustedBase)),
  };
}

export function calculateLateRentalCharge(
  expectedReturnAt: string | Date,
  actualReturnAt: string | Date,
  dailyRate: number,
  graceHours = 3,
): LateRentalCharge {
  const expected = expectedReturnAt instanceof Date ? expectedReturnAt : new Date(expectedReturnAt);
  const actual = actualReturnAt instanceof Date ? actualReturnAt : new Date(actualReturnAt);
  const graceMs = Math.max(0, graceHours) * 60 * 60 * 1000;
  if (Number.isNaN(expected.getTime()) || Number.isNaN(actual.getTime())) {
    return { graceHours, lateMilliseconds: 0, extraRentalDays: 0, charge: 0 };
  }
  // The booked expected return time is not the charging cutoff. The customer
  // gets the full grace period first. Example: expected 10:00 -> cutoff 13:00.
  // At 13:00 there is still no late charge; the first extra day starts only
  // after the cutoff.
  const graceDeadlineMs = expected.getTime() + graceMs;
  const lateMilliseconds = Math.max(0, actual.getTime() - graceDeadlineMs);
  const extraRentalDays = lateMilliseconds > 0 ? Math.ceil(lateMilliseconds / 86_400_000) : 0;
  return {
    graceHours,
    lateMilliseconds,
    extraRentalDays,
    charge: roundMoney(extraRentalDays * nonNegative(dailyRate)),
  };
}

export function calculateExpectedReturnKilometer(
  startingKilometer: number,
  rentalDays: number,
  allowedKmPerDay: number,
) {
  return Math.round(nonNegative(startingKilometer) + nonNegative(rentalDays) * nonNegative(allowedKmPerDay));
}

export function calculateSettlement(input: SettlementCalculationInput): SettlementCalculation {
  const allowedKilometers = Math.round(nonNegative(input.rentalDays) * nonNegative(input.allowedKmPerDay));
  const expectedReturnKilometer = calculateExpectedReturnKilometer(
    input.startingKilometer,
    input.rentalDays,
    input.allowedKmPerDay,
  );
  const extraKilometers = Math.max(0, Math.round(input.actualReturnKilometer - expectedReturnKilometer));
  const extraKmCharge = roundMoney(extraKilometers * nonNegative(input.extraKmRate));
  const { fuelRangeShortageKm, requiredFuelLitres, fuelCharge } = calculateFuelShortageCharge(
    input.startingFuelRangeKm,
    input.returnFuelRangeKm,
    input.mileageKmPerLitre,
    input.fuelPricePerLitre,
  );
  const additionalCharges = roundMoney(
    nonNegative(input.existingOtherCharges ?? 0) +
      nonNegative(input.lateFee ?? 0) +
      nonNegative(input.cleaningCharge ?? 0) +
      nonNegative(input.damageCharge ?? 0) +
      extraKmCharge +
      fuelCharge,
  );
  const subtotal = roundMoney(nonNegative(input.baseRentalAmount) + additionalCharges);
  const discountAmount = roundMoney(nonNegative(input.discountAmount ?? 0));
  const finalAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const amountDue = normalisePendingBalance(finalAmount - nonNegative(input.amountAlreadyPaid ?? 0));

  return {
    allowedKilometers,
    expectedReturnKilometer,
    extraKilometers,
    extraKmCharge,
    fuelRangeShortageKm,
    requiredFuelLitres,
    fuelCharge,
    additionalCharges,
    subtotal,
    discountAmount,
    finalAmount,
    amountDue,
  };
}

type WhatsAppSettlement = {
  customerName: string;
  phone: string;
  vehicleName: string;
  registrationNumber: string;
  bookingNumber: string;
  bookingStart: string;
  bookingEnd: string;
  rentalDays: number;
  startingKilometer: number;
  actualReturnKilometer: number;
  startingFuelRangeKm: number;
  returnFuelRangeKm: number;
  rentalAmount: number;
  discountAmount: number;
  discountRemark?: string | null;
  calculation: SettlementCalculation;
  segments?: {
    sequence: number;
    vehicleName: string;
    registrationNumber: string;
    isGuest: boolean;
    bookingStart: string;
    bookingEnd: string;
    rentalDays: number;
    startingKilometer?: number;
    endingKilometer?: number | null;
    rentalCharge: number;
    extraKilometers?: number;
    extraKmCharge?: number;
    startingFuelRangeKm?: number;
    returnFuelRangeKm?: number | null;
    fuelRangeShortageKm?: number;
    fuelPricePerLitre?: number;
    fuelCharge?: number;
  }[];
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const formatWholeMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));

export function normaliseWhatsAppNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export function buildSettlementWhatsAppMessage(input: WhatsAppSettlement) {
  const { calculation } = input;
  const lines = [
    "Mecardee Rental — Final Settlement",
    "",
    `Customer: ${input.customerName}`,
    `Vehicle: ${input.vehicleName} (${input.registrationNumber})`,
    `Booking: ${input.bookingNumber}`,
    `Rental period: ${input.bookingStart} to ${input.bookingEnd}`,
    `Rental days: ${input.rentalDays}`,
  ];

  if (input.segments && input.segments.length > 0) {
    lines.push("", "Vehicle-wise details:");
    for (const segment of input.segments) {
      lines.push(`Vehicle ${segment.sequence}: ${segment.vehicleName} (${segment.registrationNumber})`);
      lines.push(`Used: ${segment.bookingStart} to ${segment.bookingEnd}`);
      if (segment.startingKilometer !== undefined) {
        const endingKilometer = segment.endingKilometer ?? segment.startingKilometer;
        const travelled = Math.max(0, endingKilometer - segment.startingKilometer);
        lines.push(`Odometer: ${segment.startingKilometer} km to ${endingKilometer} km (${travelled} km used)`);
      }
      lines.push(`Rental days: ${segment.rentalDays}`);
      lines.push(`Rental charge: ${formatMoney(segment.rentalCharge)}`);
      if ((segment.extraKilometers ?? 0) > 0) lines.push(`Extra kilometers: ${segment.extraKilometers} km`);
      if ((segment.extraKmCharge ?? 0) > 0) lines.push(`Extra KM charge: ${formatMoney(segment.extraKmCharge ?? 0)}`);
      if (segment.startingFuelRangeKm !== undefined && segment.returnFuelRangeKm !== null && segment.returnFuelRangeKm !== undefined) {
        lines.push(`Fuel range: ${segment.startingFuelRangeKm} km to ${segment.returnFuelRangeKm} km`);
      }
      if ((segment.fuelCharge ?? 0) > 0) {
        lines.push(`Fuel shortage: ${segment.fuelRangeShortageKm ?? 0} km`);
        lines.push(`Fuel charge: ${formatMoney(segment.fuelCharge ?? 0)}${segment.fuelPricePerLitre !== undefined ? ` at ${formatMoney(segment.fuelPricePerLitre)}/L` : ""}`);
      }
      lines.push(`Vehicle total: ${formatMoney(segment.rentalCharge + (segment.extraKmCharge ?? 0) + (segment.fuelCharge ?? 0))}`);
      lines.push("");
    }
  }

  lines.push(`Starting kilometer: ${input.startingKilometer} km`);
  lines.push(`Actual return kilometer: ${input.actualReturnKilometer} km`);
  lines.push(`Allowed kilometers: ${calculation.allowedKilometers} km`);

  if (calculation.extraKilometers > 0) {
    lines.push(`Extra kilometers: ${calculation.extraKilometers} km`);
    lines.push(`Extra KM charge: ${formatMoney(calculation.extraKmCharge)}`);
  }

  lines.push(`Starting fuel range: ${input.startingFuelRangeKm} km`);
  lines.push(`Return fuel range: ${input.returnFuelRangeKm} km`);
  if (calculation.fuelCharge > 0) {
    lines.push(`Fuel shortage charge: ${formatMoney(calculation.fuelCharge)}`);
  }
  lines.push(`Rental amount: ${formatMoney(input.rentalAmount)}`);
  if (input.discountAmount > 0) {
    lines.push(`Discount: ${formatMoney(input.discountAmount)}`);
    if (input.discountRemark?.trim()) lines.push(`Discount remark: ${input.discountRemark.trim()}`);
  }
  lines.push(`Final amount: ${formatWholeMoney(calculation.finalAmount)}`);
  if (calculation.amountDue > 0) lines.push(`Balance due: ${formatWholeMoney(calculation.amountDue)}`);
  lines.push("Booking status: Completed");
  lines.push("", "Thank you for choosing Mecardee Rental Cars.");
  return lines.join("\n");
}

export function buildSettlementWhatsAppUrl(input: WhatsAppSettlement) {
  const phone = normaliseWhatsAppNumber(input.phone);
  const message = buildSettlementWhatsAppMessage(input);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
