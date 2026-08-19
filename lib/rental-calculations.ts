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
  const fuelRangeShortageKm = Math.max(
    0,
    Math.round(input.startingFuelRangeKm - input.returnFuelRangeKm),
  );
  const mileage = nonNegative(input.mileageKmPerLitre);
  const requiredFuelLitres = mileage > 0 ? Math.round((fuelRangeShortageKm / mileage) * 1000) / 1000 : 0;
  const fuelCharge = roundMoney(requiredFuelLitres * nonNegative(input.fuelPricePerLitre));
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
  const amountDue = roundMoney(Math.max(0, finalAmount - nonNegative(input.amountAlreadyPaid ?? 0)));

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
    rentalCharge: number;
    extraKmCharge?: number;
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

  if (input.segments && input.segments.length > 1) {
    lines.push("", "Vehicle usage:");
    for (const segment of input.segments) {
      lines.push(`Vehicle ${segment.sequence}${segment.isGuest ? " — Guest Car" : ""}: ${segment.vehicleName} (${segment.registrationNumber})`);
      lines.push(`Used: ${segment.bookingStart} to ${segment.bookingEnd}`);
      lines.push(`Rental days: ${segment.rentalDays}`);
      lines.push(`Rental charge: ${formatMoney(segment.rentalCharge)}`);
      if ((segment.extraKmCharge ?? 0) > 0) lines.push(`Segment extra KM charge: ${formatMoney(segment.extraKmCharge ?? 0)}`);
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
