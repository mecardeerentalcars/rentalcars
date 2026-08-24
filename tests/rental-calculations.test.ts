import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExpectedReturnKilometer,
  calculateFuelShortageCharge,
  calculateLateRentalCharge,
  calculateRentalChargeForActualReturn,
  calculateSettlement,
  buildSettlementWhatsAppMessage,
  normalisePendingBalance,
  rentalDaysFromSchedule,
} from "../lib/rental-calculations";
import { calculateSegmentCharge, roundFinalPayable } from "../lib/rental-segments";
import { formatSimpleBookingNumber } from "../lib/simple-booking-number";
import { formatSimplePaymentNumber } from "../lib/simple-payment-number";
import { effectiveBookingCalendarEndAt } from "../lib/booking-calendar";

test("booking and rental number series both start from a compact 001", () => {
  assert.equal(formatSimpleBookingNumber("BKG", 1), "BKG-001");
  assert.equal(formatSimpleBookingNumber("RNT", 1), "RNT-001");
  assert.equal(formatSimpleBookingNumber("DRF", 1), "DRF-001");
  assert.equal(formatSimpleBookingNumber("BKG", 12), "BKG-012");
});

test("payment number series uses the same compact 001 format", () => {
  assert.equal(formatSimplePaymentNumber(1), "PAY-001");
  assert.equal(formatSimplePaymentNumber(12), "PAY-012");
});

test("completed calendar entries stop on the actual early-return date", () => {
  const scheduledEndAt = "2026-08-25T13:00:00+05:30";
  const actualReturnAt = "2026-08-24T14:37:00+05:30";

  assert.equal(effectiveBookingCalendarEndAt(scheduledEndAt, "completed", actualReturnAt), actualReturnAt);
  assert.equal(effectiveBookingCalendarEndAt(scheduledEndAt, "rented", actualReturnAt), scheduledEndAt);
  assert.equal(effectiveBookingCalendarEndAt(scheduledEndAt, "completed", null), scheduledEndAt);
});

test("expected return kilometer uses rental days and the vehicle allowance", () => {
  assert.equal(calculateExpectedReturnKilometer(50_000, 5, 100), 50_500);
});

test("booking days are derived from the India calendar dates shown to staff", () => {
  assert.equal(
    rentalDaysFromSchedule("2026-08-20T13:00:00+05:30", "2026-08-30T13:00:00+05:30"),
    10,
  );
  assert.equal(
    rentalDaysFromSchedule("2026-08-20T23:00:00+05:30", "2026-08-21T01:00:00+05:30"),
    1,
  );
});

test("balances below one rupee are settled instead of shown as pending", () => {
  assert.equal(normalisePendingBalance(0.99), 0);
  assert.equal(normalisePendingBalance(1), 1);
  assert.equal(normalisePendingBalance(1.01), 1.01);
  assert.equal(normalisePendingBalance(-5), 0);
});

test("fuel litre rounding is identical in change-vehicle and final settlement calculations", () => {
  const fuel = calculateFuelShortageCharge(101, 100, 3, 100);
  assert.deepEqual(fuel, {
    fuelRangeShortageKm: 1,
    requiredFuelLitres: 0.333,
    fuelCharge: 33.3,
  });
  const settlement = calculateSettlement({
    baseRentalAmount: 0,
    rentalDays: 1,
    startingKilometer: 0,
    actualReturnKilometer: 0,
    allowedKmPerDay: 0,
    extraKmRate: 0,
    startingFuelRangeKm: 101,
    returnFuelRangeKm: 100,
    mileageKmPerLitre: 3,
    fuelPricePerLitre: 100,
  });
  assert.equal(settlement.requiredFuelLitres, fuel.requiredFuelLitres);
  assert.equal(settlement.fuelCharge, fuel.fuelCharge);
});

test("extra kilometers and fuel shortage are charged automatically", () => {
  const result = calculateSettlement({
    baseRentalAmount: 15_000,
    rentalDays: 5,
    startingKilometer: 50_000,
    actualReturnKilometer: 50_650,
    allowedKmPerDay: 100,
    extraKmRate: 12,
    startingFuelRangeKm: 100,
    returnFuelRangeKm: 50,
    mileageKmPerLitre: 20,
    fuelPricePerLitre: 100,
    discountAmount: 1_000,
    amountAlreadyPaid: 3_000,
  });

  assert.equal(result.expectedReturnKilometer, 50_500);
  assert.equal(result.extraKilometers, 150);
  assert.equal(result.extraKmCharge, 1_800);
  assert.equal(result.fuelRangeShortageKm, 50);
  assert.equal(result.requiredFuelLitres, 2.5);
  assert.equal(result.fuelCharge, 250);
  assert.equal(result.subtotal, 17_050);
  assert.equal(result.finalAmount, 16_050);
  assert.equal(result.amountDue, 13_050);
});

test("unused kilometers and extra fuel never create a refund", () => {
  const result = calculateSettlement({
    baseRentalAmount: 10_000,
    rentalDays: 5,
    startingKilometer: 50_000,
    actualReturnKilometer: 50_400,
    allowedKmPerDay: 100,
    extraKmRate: 12,
    startingFuelRangeKm: 100,
    returnFuelRangeKm: 110,
    mileageKmPerLitre: 20,
    fuelPricePerLitre: 100,
  });

  assert.equal(result.extraKilometers, 0);
  assert.equal(result.extraKmCharge, 0);
  assert.equal(result.fuelRangeShortageKm, 0);
  assert.equal(result.fuelCharge, 0);
  assert.equal(result.finalAmount, 10_000);
});

test("early return uses one chargeable day per started 24 hours after the cooling period", () => {
  const result = calculateRentalChargeForActualReturn(
    "2026-08-21T10:00:00+05:30",
    "2026-08-25T10:00:00+05:30",
    "2026-08-24T11:59:00+05:30",
    1_400,
    4,
    5_100,
  );

  assert.equal(result.isEarlyReturn, true);
  assert.equal(result.chargeableRentalDays, 3);
  assert.equal(result.baseRentalAmount, 3_700);
  assert.equal(result.amountSaved, 1_400);
});

test("late fee starts only after the complete three-hour grace period", () => {
  const expected = "2026-08-25T10:00:00+05:30";
  assert.deepEqual(calculateLateRentalCharge(expected, "2026-08-25T13:00:00+05:30", 1_400), {
    graceHours: 3,
    lateMilliseconds: 0,
    extraRentalDays: 0,
    charge: 0,
  });
  assert.equal(calculateLateRentalCharge(expected, "2026-08-25T13:01:00+05:30", 1_400).charge, 1_400);
});

test("vehicle segment calculation keeps rental days, kilometer allowance, and extra charge aligned", () => {
  const result = calculateSegmentCharge({
    startAt: "2026-08-21T10:00:00+05:30",
    endAt: "2026-08-24T12:00:00+05:30",
    dailyRate: 1_300,
    startingKilometer: 18_165,
    endingKilometer: 18_531,
    allowedKmPerDay: 100,
    extraKmRate: 8,
  });

  assert.deepEqual(result, {
    rentalDays: 3,
    rentalCharge: 3_900,
    allowedKilometers: 300,
    extraKilometers: 66,
    extraKmCharge: 528,
  });
});

test("Reji early return finalizes three days and uses the same three-day KM allowance", () => {
  const rental = calculateRentalChargeForActualReturn(
    "2026-08-21T13:00:00+05:30",
    "2026-08-25T13:00:00+05:30",
    "2026-08-24T14:37:00+05:30",
    1_300,
    4,
    5_200,
  );
  const segment = calculateSegmentCharge({
    startAt: "2026-08-21T13:00:00+05:30",
    endAt: "2026-08-24T14:37:00+05:30",
    dailyRate: 1_300,
    startingKilometer: 18_165,
    endingKilometer: 18_529,
    allowedKmPerDay: 100,
    extraKmRate: 8,
  });

  assert.equal(rental.chargeableRentalDays, 3);
  assert.equal(rental.baseRentalAmount, 3_900);
  assert.equal(segment.rentalDays, 3);
  assert.equal(segment.allowedKilometers, 300);
  assert.equal(segment.extraKilometers, 64);
  assert.equal(segment.extraKmCharge, 512);
});

test("only the final payable is rounded to the nearest whole rupee", () => {
  assert.equal(roundFinalPayable(5_599.49), 5_599);
  assert.equal(roundFinalPayable(5_599.5), 5_600);
});

test("customer settlement names every vehicle without exposing Guest Car classification", () => {
  const calculation = calculateSettlement({
    baseRentalAmount: 1_300,
    rentalDays: 1,
    startingKilometer: 18_165,
    actualReturnKilometer: 18_526,
    allowedKmPerDay: 100,
    extraKmRate: 8,
    startingFuelRangeKm: 110,
    returnFuelRangeKm: 1,
    mileageKmPerLitre: 10,
    fuelPricePerLitre: 115,
  });
  const message = buildSettlementWhatsAppMessage({
    customerName: "Customer",
    phone: "9999999999",
    vehicleName: "Toyota Taisor",
    registrationNumber: "KL 35 N 6181",
    bookingNumber: "BKG-999",
    bookingStart: "21 Aug, 1:00 pm",
    bookingEnd: "24 Aug, 2:37 pm",
    rentalDays: 1,
    startingKilometer: 18_165,
    actualReturnKilometer: 18_526,
    startingFuelRangeKm: 110,
    returnFuelRangeKm: 1,
    rentalAmount: 1_300,
    discountAmount: 0,
    calculation,
    segments: [{
      sequence: 1,
      vehicleName: "Toyota Taisor",
      registrationNumber: "KL 35 N 6181",
      isGuest: true,
      bookingStart: "21 Aug, 1:00 pm",
      bookingEnd: "24 Aug, 2:37 pm",
      rentalDays: 1,
      startingKilometer: 18_165,
      endingKilometer: 18_526,
      rentalCharge: 1_300,
      extraKilometers: calculation.extraKilometers,
      extraKmCharge: calculation.extraKmCharge,
      startingFuelRangeKm: 110,
      returnFuelRangeKm: 1,
      fuelRangeShortageKm: calculation.fuelRangeShortageKm,
      fuelPricePerLitre: 115,
      fuelCharge: calculation.fuelCharge,
    }],
  });

  assert.match(message, /Vehicle 1: Toyota Taisor \(KL 35 N 6181\)/);
  assert.match(message, /Odometer: 18165 km to 18526 km \(361 km used\)/);
  assert.match(message, /Extra kilometers: 261 km/);
  assert.match(message, /Fuel range: 110 km to 1 km/);
  assert.doesNotMatch(message, /Guest Car/i);
});
