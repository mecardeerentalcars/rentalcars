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
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

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
    `Starting kilometer: ${input.startingKilometer} km`,
    `Actual return kilometer: ${input.actualReturnKilometer} km`,
    `Allowed kilometers: ${calculation.allowedKilometers} km`,
  ];

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
  lines.push(`Final amount: ${formatMoney(calculation.finalAmount)}`);
  if (calculation.amountDue > 0) lines.push(`Balance due: ${formatMoney(calculation.amountDue)}`);
  lines.push("Booking status: Completed");
  lines.push("", "Thank you for choosing Mecardee Rental Cars.");
  return lines.join("\n");
}

export function buildSettlementWhatsAppUrl(input: WhatsAppSettlement) {
  const phone = normaliseWhatsAppNumber(input.phone);
  const message = buildSettlementWhatsAppMessage(input);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
