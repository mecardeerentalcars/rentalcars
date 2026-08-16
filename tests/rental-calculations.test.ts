import assert from "node:assert/strict";
import test from "node:test";
import { calculateExpectedReturnKilometer, calculateSettlement } from "../lib/rental-calculations";

test("expected return kilometer uses rental days and the vehicle allowance", () => {
  assert.equal(calculateExpectedReturnKilometer(50_000, 5, 100), 50_500);
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
